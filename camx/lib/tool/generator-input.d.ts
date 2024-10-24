export interface GeneratorInput<K> {
    value?: string | number | boolean;
    options?: Array<{
        key: string;
        value: string | number;
    }>;
    label?: string;
    description?: string;
    append?: string;
    prepend?: string;
    placeholder?: string;
    order?: number;
    controlType: 'selection' | 'option' | 'text' | 'bool';
    type: 'text' | 'number' | 'email' | 'checkbox' | 'radio';
    name: Extract<keyof K, string>;
    min?: number;
    max?: number;
    minlength?: number;
    maxlength?: number;
    required?: boolean;
}
