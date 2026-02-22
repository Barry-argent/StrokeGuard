const rawText = `Your vitals are generally stable, but PRV indicates mild stress.

Here is your action plan:
- **Drink water**: Hydration is key.
- Take a 15 min walk.
1. Check blood pressure later.`;

const listRegex = /^(?:-|\*|\d+\.)\s+(.+)$/gm;
const tasks = [];
let match;
while ((match = listRegex.exec(rawText)) !== null) {
  tasks.push(match[1].trim());
}
const summary = rawText.replace(listRegex, '').trim();

console.log("Tasks:", tasks);
console.log("Summary:", summary);
