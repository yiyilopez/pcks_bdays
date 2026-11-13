// Confirmed in the employee birthday report; photo provided by the user.
// Keep this addition when the public sheet refreshes, without duplicating a
// matching entry if it is later added to the sheet.
const additionalBirthdays = [
  { name: 'Kenneth Nachbar', month: 11, day: 4, photo: '/assets/kenneth-nachbar.png' },
];

const normalizedName = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function withAdditionalBirthdays(people, month) {
  const result = people.map(person => ({ ...person }));
  for (const person of additionalBirthdays.filter(person => person.month === month)) {
    const existing = result.find(entry => entry.day === person.day && normalizedName(entry.name) === normalizedName(person.name));
    if (existing) existing.photo = person.photo;
    else result.push({ name: person.name, day: person.day, photo: person.photo });
  }
  return result.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

module.exports = { withAdditionalBirthdays };
