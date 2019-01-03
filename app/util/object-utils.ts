export function pickRandomProperty(obj: any) {
    let result;
    let count = 0;
    for (const prop in obj) {
        if (Math.random() < 1 / ++count) {
            result = prop;
        }
    }
    return result;
}
