import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { WeatherTool } from './weather.js';

describe('WeatherTool', () => {
    it('rejects missing city', async () => {
        const tool = new WeatherTool();

        await expect(
            tool.execute(
                {},
                {
                    tenantId: 'test-tenant',
                }
            )
        ).rejects.toThrow(
            'city is required'
        );
    });

    it('returns normalized weather data', async () => {
        const tool = new WeatherTool();

        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                new Response(
                    JSON.stringify({
                        current_condition: [
                            {
                                temp_C: '28',
                                FeelsLikeC: '29',
                                humidity: '72',
                                weatherDesc: [
                                    {
                                        value: 'Partly cloudy',
                                    },
                                ],
                            },
                        ],
                    }),
                    {
                        status: 200,
                        headers: {
                            'Content-Type':
                                'application/json',
                        },
                    }
                )
            );

        const result =
            await tool.execute(
                {
                    city: 'Pune',
                },
                {
                    tenantId: 'test-tenant',
                }
            );

        expect(
            JSON.parse(result)
        ).toEqual({
            city: 'Pune',
            temperatureC: '28',
            feelsLikeC: '29',
            humidity: '72',
            description: 'Partly cloudy',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            'https://wttr.in/Pune?format=j1'
        );

        fetchMock.mockRestore();
    });
});