import type {
    Tool,
    ToolExecutionContext,
} from './types.js';

export class CalculatorTool implements Tool {
    readonly name = 'calculator';

    readonly description =
        'Perform basic arithmetic calculations using numbers and +, -, *, / operators.';

    readonly parameters = {
        type: 'object',
        properties: {
            expression: {
                type: 'string',
                description:
                    'Arithmetic expression such as 25 * 18 or 100 / 4',
            },
        },
        required: ['expression'],
    };

    async execute(
        input: Record<string, unknown>,
        _context?: ToolExecutionContext
    ): Promise<string> {
        const expression = input.expression;

        if (typeof expression !== 'string') {
            throw new Error(
                'Calculator expression must be a string'
            );
        }

        if (
            !/^[0-9+\-*/().\s]+$/.test(expression)
        ) {
            throw new Error(
                'Calculator expression contains unsupported characters'
            );
        }

        const tokens = expression.match(
            /\d+(?:\.\d+)?|[+\-*/()]/
        );

        if (!tokens) {
            throw new Error(
                'Invalid calculator expression'
            );
        }

        const result = this.evaluate(expression);

        return String(result);
    }

    private evaluate(expression: string): number {
        const values: number[] = [];
        const operators: string[] = [];

        const precedence = (operator: string): number => {
            if (
                operator === '*' ||
                operator === '/'
            ) {
                return 2;
            }

            return 1;
        };

        const applyOperator = (): void => {
            const operator = operators.pop();

            const right = values.pop();
            const left = values.pop();

            if (
                !operator ||
                left === undefined ||
                right === undefined
            ) {
                throw new Error(
                    'Invalid calculator expression'
                );
            }

            switch (operator) {
                case '+':
                    values.push(left + right);
                    break;

                case '-':
                    values.push(left - right);
                    break;

                case '*':
                    values.push(left * right);
                    break;

                case '/':
                    if (right === 0) {
                        throw new Error(
                            'Division by zero'
                        );
                    }

                    values.push(left / right);
                    break;

                default:
                    throw new Error(
                        'Unsupported operator'
                    );
            }
        };

        const tokens =
            expression.match(
                /\d+(?:\.\d+)?|[+\-*/()]/g
            );

        if (!tokens) {
            throw new Error(
                'Invalid calculator expression'
            );
        }

        for (const token of tokens) {
            if (!Number.isNaN(Number(token))) {
                values.push(Number(token));
                continue;
            }

            if (token === '(') {
                operators.push(token);
                continue;
            }

            if (token === ')') {
                while (
                    operators.length &&
                    operators[operators.length - 1] !== '('
                ) {
                    applyOperator();
                }

                if (operators.pop() !== '(') {
                    throw new Error(
                        'Mismatched parentheses'
                    );
                }

                continue;
            }

            while (
                operators.length &&
                operators[operators.length - 1] !== '(' &&
                precedence(
                    operators[operators.length - 1]!
                ) >= precedence(token)
            ) {
                applyOperator();
            }

            operators.push(token);
        }

        while (operators.length) {
            if (
                operators[operators.length - 1] === '('
            ) {
                throw new Error(
                    'Mismatched parentheses'
                );
            }

            applyOperator();
        }

        if (values.length !== 1) {
            throw new Error(
                'Invalid calculator expression'
            );
        }

        return values[0]!;
    }
}