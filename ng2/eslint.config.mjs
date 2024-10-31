// @ts-check
import tsParser from '@typescript-eslint/parser';
import { defineFlatConfig } from 'eslint-define-config';
import stylisticTs from '@stylistic/eslint-plugin-ts'

// /// <reference types="@eslint-types/typescript-eslint" />
// /// <reference types="@stylistic/eslint-plugin-ts" />
//console.log(stylistic.configs['recommended-flat'])
//console.log(prettier.configs)
export default defineFlatConfig(
    [
        {
            ignores: [
                "/dist",
                "config/",
            ],
            languageOptions: {
                parser: tsParser,
                parserOptions:{
                    sourceType: 'module',
                }
            },
            files: ["/src/**/*.ts"],
            plugins: {
                //'@stylistic/ts': stylisticTs,
                //'@stylistic': stylistic,
                //'prettier': prettier
            },
            rules: {
                //'indent': ['error', 3],
                // Semicolon
                'semi': 'off', // Disable semicolons

                // Quote style
                'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }],

                // Import and comment formatting
                'sort-imports': 'off', // Disable ordered imports
                'spaced-comment': 'off', // Disable comment format enforcement

                // Warnings for unused variables
                'no-unused-vars': 'warn',

                // Object and interface rules
                'sort-keys': 'off', // Disable sorting of object literals

                // Class and file restrictions
                'max-classes-per-file': 'off', // Disable max classes per file

                // Console and variable naming
                'no-console': 'off', // Disable no-console rule
                'naming-convention': 'off', // Disable naming conventions

                // Function and expression rules
                'prefer-arrow/prefer-arrow-functions': 'off', // Disable only-arrow-functions rule
                'comma-dangle': 'off', // Disable trailing comma enforcement
                'space-before-function-paren': 'off', // Disable space before function parenthesis

                // Line length and member access
                'max-len': 'off', // Disable max line length

                // Block and arrow function rules
                'no-empty': 'off', // Disable empty block rule
                'arrow-parens': 'off', // Disable arrow parens rule
                'class-methods-use-this': 'off', // Disable member ordering
                'padded-blocks': 'off', // Disable block padding
                'one-var': 'off', // Disable one variable per declaration
                'no-shadow': 'off', // Disable no shadowed variable rule
                'global-require': 'off', // Disable no var requires

                // Const and variable rules
                'prefer-const': 'error', // Enforce prefer const
                'one-line': 'off', // Disable one-line rule
                'no-multi-spaces': 'off', // Disable multiple spaces rule
                'no-trailing-spaces': 'off', // Disable trailing whitespace rule
                'type-annotation-spacing': 'off', // Disable type annotation spacing

                // Curly brace enforcement
                'curly': 'error', // Enforce curly braces

                // Miscellaneous
                'no-multiple-empty-lines': 'off', // Disable multiple empty lines rule
                'no-var': 'error', // Enforce no var keyword
            },
        }
   ]
);

