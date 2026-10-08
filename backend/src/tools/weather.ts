import type {
    Tool,
    ToolExecutionContext,
} from './types.js';

export class WeatherTool implements Tool {
    readonly name = 'weather';

    readonly description =
        'Get the current weather for a city.';

    readonly parameters = {
        type: 'object',
        properties: {
            city: {
                type: 'string',
                description:
                    'The city to get the current weather for.',
            },
        },
        required: ['city'],
    };

    async execute(
        input: Record<string, unknown>,
        _context: ToolExecutionContext
    ): Promise<string> {
        const city = input.city;

        if (
            typeof city !== 'string' ||
            !city.trim()
        ) {
            throw new Error(
                'city is required'
            );
        }

        const url =
            `https://wttr.in/${encodeURIComponent(city)}?format=j1`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Weather service returned ${response.status}`
            );
        }

        const data = await response.json();

        const current =
            data?.current_condition?.[0];

        if (!current) {
            throw new Error(
                'Weather data was unavailable'
            );
        }

        return JSON.stringify({
            city,
            temperatureC:
                current.temp_C,
            feelsLikeC:
                current.FeelsLikeC,
            humidity:
                current.humidity,
            description:
                current.weatherDesc?.[0]?.value ?? '',
        });
    }
}