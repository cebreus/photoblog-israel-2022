declare module 'cli-progress' {
  export class SingleBar {
    constructor(options?: any, preset?: any);
    start(total: number, startValue?: number, payload?: any): void;
    update(current: number, payload?: any): void;
    stop(): void;
    render(): void;
  }
}
