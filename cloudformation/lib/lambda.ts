import fs from 'node:fs';

export default function inlineLambda(name: string): string {
    return String(fs.readFileSync(new URL(`../../${name}.cjs`, import.meta.url)));
}
