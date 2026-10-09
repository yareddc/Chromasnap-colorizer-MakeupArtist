import { getProvider } from '../ai/provider';

/**
 * "Find This Look" commerce / local-services abstraction.
 *
 * This layer is intentionally provider-agnostic so real retailers, affiliate
 * networks, and booking platforms can be plugged in later without touching the
 * route handlers or frontend. The default provider generates recommendations
 * with AI; a future implementation could delegate to Shopify, Amazon,
 * a booking API, etc.
 */

export interface ProductRecommendation {
    name: string;
    category: string;
    image?: string;
    price?: string;
    brand?: string;
    productUrl?: string;
    affiliateUrl?: string;
    retailer?: string;
}

export interface ServiceRecommendation {
    name: string;
    type: 'barber' | 'hair-salon' | 'beauty-salon' | 'stylist';
    description?: string;
    location?: string;
}

export interface FindThisLookResult {
    fashion: ProductRecommendation[];
    services: ServiceRecommendation[];
}

export interface LookFinderProvider {
    /** Find similar fashion products for a described look. */
    findFashion(lookDescription: string): Promise<ProductRecommendation[]>;
    /** Find local services (barbers, salons, stylists) for a described look. */
    findServices(lookDescription: string, location?: string): Promise<ServiceRecommendation[]>;
}

const cleanJson = (text: string): string =>
    text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

const parseArray = (text: string | undefined): any[] => {
    if (!text) return [];
    try {
        const parsed = JSON.parse(cleanJson(text));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export class AILookFinderProvider implements LookFinderProvider {
    readonly name = 'ai-look-finder';

    async findFashion(lookDescription: string): Promise<ProductRecommendation[]> {
        const provider = getProvider();
        const prompt = [
            'Find real-world fashion products similar to this look.',
            `Look: ${lookDescription}`,
            '',
            'Return ONLY a JSON array of 5-8 products. Each object must have:',
            '- name: product name',
            '- category: shoes, clothing, bag, jewelry, sunglasses, hat, accessory, or beauty',
            '- price: an estimated retail price range (e.g. "$50 - $120")',
            '- brand: a plausible brand or brand type (e.g. "high-street", "designer", "athleisure")',
            '- retailer: a generic retailer type (e.g. "department store", "online boutique", "sporting goods")',
            '',
            'Do NOT fabricate specific product URLs. Leave productUrl and affiliateUrl out.',
            'Respond with ONLY the JSON array.',
        ].join('\n');

        const result = await provider.generateText({
            userId: 'system',
            featureType: 'COMPLETE_LOOK',
            sourceImage: '',
            prompt,
        });

        return parseArray(result.text).map((item: any) => ({
            name: String(item?.name || ''),
            category: String(item?.category || 'accessory'),
            price: item?.price ? String(item.price) : undefined,
            brand: item?.brand ? String(item.brand) : undefined,
            retailer: item?.retailer ? String(item.retailer) : undefined,
        })).filter((item) => item.name);
    }

    async findServices(lookDescription: string, location?: string): Promise<ServiceRecommendation[]> {
        const provider = getProvider();
        const prompt = [
            'Recommend local style services that could help achieve this look.',
            `Look: ${lookDescription}`,
            location ? `Location: ${location}` : '',
            '',
            'Return ONLY a JSON array of 3-5 services. Each object must have:',
            '- name: a descriptive service name',
            '- type: one of barber, hair-salon, beauty-salon, stylist',
            '- description: what the service provides',
            '',
            'Respond with ONLY the JSON array.',
        ].filter(Boolean).join('\n');

        const result = await provider.generateText({
            userId: 'system',
            featureType: 'COMPLETE_LOOK',
            sourceImage: '',
            prompt,
        });

        const validTypes = ['barber', 'hair-salon', 'beauty-salon', 'stylist'];
        return parseArray(result.text).map((item: any) => ({
            name: String(item?.name || ''),
            type: validTypes.includes(item?.type) ? (item.type as ServiceRecommendation['type']) : 'stylist',
            description: item?.description ? String(item.description) : undefined,
            location: location || undefined,
        })).filter((item) => item.name);
    }
}

let defaultFinder: LookFinderProvider | null = null;

export const getLookFinder = (): LookFinderProvider => {
    if (!defaultFinder) {
        defaultFinder = new AILookFinderProvider();
    }
    return defaultFinder;
};
