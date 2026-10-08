import { ToolRegistry } from './registry.js';
import { CalculatorTool } from './calculator.js';
import { SearchDocumentsTool } from './search-documents.js';
import { WeatherTool } from './weather.js';

export const toolRegistry =
    new ToolRegistry();

toolRegistry.register(
    new CalculatorTool()
);

toolRegistry.register(
    new SearchDocumentsTool()
);

toolRegistry.register(
    new WeatherTool()
);