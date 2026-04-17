# Billing Persistence Schema

This document describes the SQLite billing storage implemented in server/src/userDatabase.ts.

## Tables

### billing_accounts
- user_id TEXT PRIMARY KEY COLLATE NOCASE
- tier TEXT NOT NULL CHECK(tier IN ('free', 'pro', 'enterprise'))
- token_balance INTEGER NOT NULL
- monthly_remaining_top_up INTEGER NOT NULL
- cycle_started_at INTEGER NOT NULL (Unix ms)
- updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

Purpose:
- Stores current subscription tier and token counters per user.
- Replaces in-memory account state so Cloud Run restarts do not reset balances.

### billing_usage_events
- id TEXT PRIMARY KEY
- user_id TEXT NOT NULL COLLATE NOCASE
- timestamp INTEGER NOT NULL (Unix ms)
- action TEXT NOT NULL
- tokens INTEGER NOT NULL

Indexes:
- idx_billing_usage_user_timestamp on (user_id, timestamp DESC)

Purpose:
- Stores immutable usage and credit events for subscription activity and token charging.
- API returns most recent events for current billing cycle.

### billing_consumed_play_tokens
- purchase_token TEXT PRIMARY KEY
- user_id TEXT NOT NULL COLLATE NOCASE
- product_id TEXT NOT NULL
- product_type TEXT NOT NULL CHECK(product_type IN ('subs', 'inapp'))
- order_id TEXT NULL
- purchase_time_millis INTEGER NULL
- consumed_at INTEGER NOT NULL (Unix ms)

Purpose:
- Provides replay protection for Google Play purchase tokens.
- Survives process restarts and multi-revision Cloud Run rollouts.

## Invariants

- A user has at most one account row in billing_accounts.
- A purchase token can be consumed at most once.
- Usage history is capped to latest 200 events per user.
- Billing cycle reset restores token_balance and monthly_remaining_top_up based on current tier.

## Operational Notes

- All writes are followed by queuePersistDatabase() to sync the SQLite file to GCS when USER_DB_GCS_BUCKET is configured.
- In production, direct subscribe/topup mutations are disabled; entitlements should be granted through Google Play verification.
