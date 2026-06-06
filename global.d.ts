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
        YANDEX_API_KEY: string;
    };
};
