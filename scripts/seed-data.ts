/** Fictional development profiles placed around Colombo and beyond. Not real people. */

export interface SeedPerson {
  displayName: string;
  username: string;
  gender: "women" | "men";
  photo: number;
  age: number | null;
  bio: string;
  interests: string[];
  area: keyof typeof AREAS;
}

export const AREAS = {
  "Colombo Fort": [6.9344, 79.8428],
  Kollupitiya: [6.9106, 79.8507],
  Bambalapitiya: [6.8897, 79.8553],
  Wellawatte: [6.8746, 79.8605],
  Borella: [6.9147, 79.8775],
  Rajagiriya: [6.9094, 79.896],
  Dehiwala: [6.8511, 79.8659],
  "Mount Lavinia": [6.839, 79.863],
  Nugegoda: [6.8649, 79.8997],
  "Sri Jayawardenepura Kotte": [6.8868, 79.9187],
  Battaramulla: [6.899, 79.918],
  Maharagama: [6.848, 79.9265],
  Moratuwa: [6.773, 79.8816],
  Negombo: [7.2083, 79.8358],
  Kandy: [7.2906, 80.6337],
  Galle: [6.0535, 80.221],
} as const satisfies Record<string, readonly [number, number]>;

export const DEMO_ACCOUNT = {
  email: "demo@langa.lk",
  username: "demo",
  displayName: "Kavi Perera",
  password: "langa-demo-123",
  bio: "Product designer by day, street-food explorer by night. Always up for a good chat over iced coffee.",
  interests: ["Design", "Street food", "Photography", "Coffee", "Cricket"],
  age: 27,
  area: "Kollupitiya" as const,
};

export const SEED_PASSWORD = "langa-demo-123";

export const PEOPLE: SeedPerson[] = [
  { displayName: "Amaya Fernando", username: "amaya.f", gender: "women", photo: 65, age: 26, area: "Bambalapitiya", bio: "Surfer, sunrise chaser and part-time barista. Ask me about the best waves in Arugam Bay 🌊", interests: ["Surfing", "Coffee", "Beach days", "Yoga"] },
  { displayName: "Kasun Jayawardena", username: "kasun.j", gender: "men", photo: 32, age: 29, area: "Rajagiriya", bio: "Backend engineer. Weekend cricketer. I make a mean kottu.", interests: ["Cricket", "Tech", "Cooking", "Startups"] },
  { displayName: "Nethmi Silva", username: "nethmi", gender: "women", photo: 44, age: 24, area: "Wellawatte", bio: "Med student who escapes into novels and long walks on Marine Drive.", interests: ["Reading", "Running", "Podcasts", "Tea"] },
  { displayName: "Ravindu Perera", username: "ravindu.p", gender: "men", photo: 75, age: 31, area: "Nugegoda", bio: "Photographer chasing golden hour across the island 📷", interests: ["Photography", "Travel", "Hiking", "Wildlife"] },
  { displayName: "Dilini Wickramasinghe", username: "dilini.w", gender: "women", photo: 68, age: 28, area: "Sri Jayawardenepura Kotte", bio: "UX researcher. Plant mum. Looking for a board-game group!", interests: ["Board games", "Design", "Art", "Coffee"] },
  { displayName: "Sahan Bandara", username: "sahan.b", gender: "men", photo: 46, age: 25, area: "Dehiwala", bio: "Guitarist in a small indie band. Let's jam?", interests: ["Live music", "Movies", "Street food", "Gaming"] },
  { displayName: "Ishara Gunasekara", username: "ishara.g", gender: "women", photo: 21, age: 30, area: "Mount Lavinia", bio: "Marine biologist. Turtles > people (mostly). Beach clean-ups every month 🐢", interests: ["Wildlife", "Volunteering", "Beach days", "Surfing"] },
  { displayName: "Tharindu Rajapaksha", username: "tharindu.r", gender: "men", photo: 51, age: 27, area: "Maharagama", bio: "Gym in the morning, anime at night. Learning Japanese.", interests: ["Fitness", "Anime", "Languages", "Gaming"] },
  { displayName: "Sanduni Herath", username: "sanduni.h", gender: "women", photo: 12, age: 23, area: "Borella", bio: "Final-year architecture student. I sketch everything.", interests: ["Art", "Design", "Photography", "Travel"] },
  { displayName: "Chamath Dissanayake", username: "chamath.d", gender: "men", photo: 22, age: 33, area: "Battaramulla", bio: "Founder of a tiny coffee roastery. Will talk beans for hours ☕", interests: ["Coffee", "Startups", "Cycling", "Podcasts"] },
  { displayName: "Hiruni Abeysekera", username: "hiruni.a", gender: "women", photo: 33, age: 26, area: "Colombo Fort", bio: "Lawyer who dances like nobody's watching. Kandyan dance & salsa 💃", interests: ["Dancing", "Live music", "Movies", "Travel"] },
  { displayName: "Pasindu Weerasinghe", username: "pasindu.w", gender: "men", photo: 61, age: 22, area: "Moratuwa", bio: "Engineering undergrad at Moratuwa. Robotics + rugby.", interests: ["Rugby", "Tech", "Football", "Gaming"] },
  { displayName: "Ruvini Senanayake", username: "ruvini.s", gender: "women", photo: 57, age: 35, area: "Nugegoda", bio: "Teacher, poet, chai enthusiast. Open to book swaps.", interests: ["Poetry", "Reading", "Tea", "Volunteering"] },
  { displayName: "Dineth Karunaratne", username: "dineth.k", gender: "men", photo: 85, age: 28, area: "Kollupitiya", bio: "Chef at a Galle Face café. Feed me your favourite street-food spot.", interests: ["Cooking", "Street food", "Running", "Travel"] },
  { displayName: "Malsha Peiris", username: "malsha.p", gender: "women", photo: 90, age: 27, area: "Dehiwala", bio: "Data analyst who hikes on weekends. Adam's Peak 6x and counting ⛰️", interests: ["Hiking", "Tech", "Photography", "Yoga"] },
  { displayName: "Yasiru Mendis", username: "yasiru.m", gender: "men", photo: 11, age: 24, area: "Wellawatte", bio: "Video editor & film nerd. Tell me your top 3 films.", interests: ["Movies", "Design", "Podcasts", "Football"] },
  { displayName: "Kavindi Ranasinghe", username: "kavindi.r", gender: "women", photo: 79, age: null, area: "Rajagiriya", bio: "New to Colombo — looking for friends to explore the city with!", interests: ["Travel", "Street food", "Live music"] },
  { displayName: "Lahiru Samarasinghe", username: "lahiru.s", gender: "men", photo: 36, age: 30, area: "Sri Jayawardenepura Kotte", bio: "Cyclist. Doing the Colombo–Kandy ride next month 🚴", interests: ["Cycling", "Fitness", "Coffee", "Wildlife"] },
  { displayName: "Senuri Jayasuriya", username: "senuri.j", gender: "women", photo: 26, age: 25, area: "Mount Lavinia", bio: "Content creator. Sunsets, sea breeze and good playlists.", interests: ["Beach days", "Photography", "Dancing", "Podcasts"] },
  { displayName: "Nuwan Ekanayake", username: "nuwan.e", gender: "men", photo: 41, age: 34, area: "Negombo", bio: "Fisherman's son turned software lead. Best seafood in Negombo is my secret.", interests: ["Tech", "Cooking", "Cricket"] },
  { displayName: "Tharushi Wijesinghe", username: "tharushi.w", gender: "women", photo: 50, age: 29, area: "Kandy", bio: "Tea-estate kid, now a tour guide in Kandy. Ask me anything about the hill country.", interests: ["Tea", "Hiking", "Travel", "Languages"] },
  { displayName: "Isuru Gamage", username: "isuru.g", gender: "men", photo: 67, age: 26, area: "Galle", bio: "Surf instructor in Unawatuna. Lessons for new friends are free 😉", interests: ["Surfing", "Fitness", "Beach days"] },
  { displayName: "Oshadi Fonseka", username: "oshadi.f", gender: "women", photo: 8, age: 31, area: "Maharagama", bio: "Volunteer vet. Will show you 200 photos of rescue dogs.", interests: ["Wildlife", "Volunteering", "Running", "Movies"] },
  { displayName: "Ashen De Silva", username: "ashen.ds", gender: "men", photo: 15, age: 23, area: "Borella", bio: "Esports player and part-time tutor. Chess challenges accepted.", interests: ["Gaming", "Board games", "Anime", "Tech"] },
];

export const SEED_CONVERSATIONS: { with: string; messages: { fromDemo: boolean; text: string; minutesAgo: number }[] }[] = [
  {
    with: "ravindu.p",
    messages: [
      { fromDemo: false, text: "Hey Kavi! Saw you're into photography too 📷", minutesAgo: 190 },
      { fromDemo: true, text: "Hi Ravindu! Yes — mostly street photography around Pettah.", minutesAgo: 185 },
      { fromDemo: false, text: "Nice! I'm doing a sunset shoot at Galle Face this weekend if you want to join.", minutesAgo: 182 },
    ],
  },
  {
    with: "dilini.w",
    messages: [
      { fromDemo: true, text: "Hi Dilini! A fellow designer 👋", minutesAgo: 60 * 26 },
      { fromDemo: false, text: "Haha hello! Are you at an agency or in-house?", minutesAgo: 60 * 26 - 4 },
      { fromDemo: true, text: "In-house at a fintech. You?", minutesAgo: 60 * 26 - 10 },
    ],
  },
];
