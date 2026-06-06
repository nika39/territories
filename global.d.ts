/// <reference types="@yandex/ymaps3-types" />

declare module "*.scss" {
    const content: Record<string, string>;
    export default content;
}

declare module "*.css" {
    const content: Record<string, string>;
    export default content;
}

declare const process: {
    env: {
        YANDEX_MAP_API_KEY: string;
    };
};

interface Window {
    ymaps3?: typeof ymaps3;
}
