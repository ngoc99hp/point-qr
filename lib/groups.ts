/** Default name for a new group: "Nhóm N" with the smallest unused N > count. */
export function nextGroupName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  let number = existingNames.length + 1;
  while (taken.has(`Nhóm ${number}`)) number += 1;
  return `Nhóm ${number}`;
}
