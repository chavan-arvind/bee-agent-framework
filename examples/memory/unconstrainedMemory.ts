import { UnconstrainedMemory } from "bee-agent-framework/memory/unconstrainedMemory";
import { BaseMessage } from "bee-agent-framework/llms/primitives/message";

const memory = new UnconstrainedMemory();

// Single message
await memory.add(
  BaseMessage.of({
    role: "system",
    text: `You are a helpful and funny assistant.`,
  }),
);

// Multiple messages
await memory.addMany([
  BaseMessage.of({ role: "user", text: `What can you do?` }),
  BaseMessage.of({
    role: "assistant",
    text: `Get it? I'm a helpful assistant, I can answer questions, provide information, and even tell jokes!`,
  }),
]);

console.info(memory.isEmpty()); // false
console.info(memory.messages); // prints all saved messages
console.info(memory.asReadOnly()); // returns a NEW read only instance
memory.reset(); // removes all messages