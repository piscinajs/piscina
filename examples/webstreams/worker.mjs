export default async function ({ readable, writable }) {
  const writer = writable.getWriter();
  for await (const chunk of readable) {
    await writer.write(chunk);
  }
  writer.close();
}
