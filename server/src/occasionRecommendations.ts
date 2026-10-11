export interface OccasionRecommendation {
    style: string;
    makeup: string;
    hair: string;
    description: string;
}

export const buildFallbackOccasionRecommendations = (occasion: string): OccasionRecommendation[] => {
    const context = String(occasion || 'everyday').trim() || 'everyday';
    return [
        {
            style: 'Classic Polished',
            makeup: 'Soft matte complexion, neutral eyes, defined brows, and medium-rose lip.',
            hair: 'Clean taper with textured top and controlled edge line.',
            description: `A balanced, client-safe look suitable for ${context}.`,
        },
        {
            style: 'Modern Contrast',
            makeup: 'Lightweight base, subtle contour, lifted liner emphasis, and satin finish.',
            hair: 'Skin-fade variation with volume at crown and natural movement.',
            description: `Adds structure and camera-ready contrast for ${context}.`,
        },
        {
            style: 'Clean Minimal',
            makeup: 'Tinted moisturizer finish, targeted correction, and natural lip tone.',
            hair: 'Crew-inspired trim with low-maintenance texture and neat perimeter.',
            description: `Low-maintenance option optimized for routine wear around ${context}.`,
        },
    ];
};

export const parseOccasionRecommendations = (text: string): OccasionRecommendation[] => {
    const extractFromStructured = (raw: unknown): OccasionRecommendation[] => {
        const source = Array.isArray(raw)
            ? raw
            : (raw && typeof raw === 'object' && Array.isArray((raw as { recommendations?: unknown[] }).recommendations))
                ? (raw as { recommendations: unknown[] }).recommendations
                : [];

        return source
            .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
            .map((item, index) => ({
                style: String(item.style || item.name || `Look ${index + 1}`).trim(),
                makeup: String(item.makeup || item.makeupDescription || '').trim(),
                hair: String(item.hair || item.hairstyle || item.hairDescription || 'Natural/Current style').trim(),
                description: String(item.description || item.why || item.whyItWorks || 'Occasion-specific styling').trim(),
            }))
            .filter((item) => item.style && item.makeup)
            .slice(0, 3);
    };

    const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonCandidate = (fencedJson?.[1] || text).trim();
    if (jsonCandidate.startsWith('{') || jsonCandidate.startsWith('[')) {
        try {
            const parsed = JSON.parse(jsonCandidate);
            const structured = extractFromStructured(parsed);
            if (structured.length) {
                return structured;
            }
        } catch {
            // Fall back to heuristic parsing below.
        }
    }

    const recommendations: OccasionRecommendation[] = [];
    const sections = text
        .replace(/\r\n/g, '\n')
        .split(/(?:---+|###+|==+|\n\s*\n)/)
        .map((section) => section.trim())
        .filter(Boolean);

    const cleanLine = (line: string): string =>
        line
            .replace(/^#{1,6}\s*/, '')
            .replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, '')
            .replace(/[*_]+/g, '')
            .trim();

    const LABEL_PATTERN = /^(Style Name|Name|Look|Style|Makeup|Makeup Description|Hair|Hairstyle|Hair Description|Why|Tips|Description|Why It Works|Why it works)\s*:\s*(.*)$/i;

    for (const section of sections.slice(0, 8)) {
        const lines = section.split('\n').map(cleanLine).filter(Boolean);
        let styleName = '';
        let makeup = '';
        let hair = '';
        let description = '';

        for (const line of lines) {
            const match = line.match(LABEL_PATTERN);
            if (match) {
                const label = match[1].toLowerCase();
                const value = match[2].trim();
                if (label === 'style name' || label === 'name' || label === 'look' || label === 'style') {
                    if (!styleName) styleName = value;
                } else if (label === 'makeup' || label === 'makeup description') {
                    if (!makeup) makeup = value;
                } else if (label === 'hair' || label === 'hairstyle' || label === 'hair description') {
                    if (!hair) hair = value;
                } else {
                    description = description ? `${description} ${value}` : value;
                }
            } else if (!styleName && !/^(here are|for |below|sure|based on|the following)/i.test(line)) {
                styleName = line;
            }
        }

        if (styleName && makeup) {
            recommendations.push({
                style: styleName,
                makeup,
                hair: hair || 'Natural/Current style',
                description: description || 'Occasion-specific styling',
            });
        }
    }

    return recommendations.slice(0, 3);
};