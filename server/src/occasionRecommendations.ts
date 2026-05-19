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
        .split(/(?:---+|###|==+|\n\s*\n)/)
        .filter(Boolean);

    for (let i = 0; i < Math.min(sections.length, 4); i += 1) {
        const section = sections[i].trim();
        if (!section) continue;

        const lines = section.split('\n').map((line) => line.trim());
        let styleName = '';
        let makeup = '';
        let hair = '';
        let description = '';

        for (const line of lines) {
            if (line.match(/^(Style Name|Name|Look):/i)) {
                styleName = line.replace(/^(Style Name|Name|Look):\s*/i, '');
            } else if (line.match(/^(Makeup|Makeup Description):/i)) {
                makeup = line.replace(/^(Makeup|Makeup Description):\s*/i, '');
            } else if (line.match(/^(Hair|Hairstyle|Hair Description):/i)) {
                hair = line.replace(/^(Hair|Hairstyle|Hair Description):\s*/i, '');
            } else if (line.match(/^(Why|Tips|Description|Why it works):/i)) {
                description += `${description ? ' ' : ''}${line.replace(/^(Why|Tips|Description|Why it works):\s*/i, '')}`;
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