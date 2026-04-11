// Here we store memes dat
// import abMaiKyaBolu from "../assets/memes/abkyabolumai.jpeg";
import homeworkPanic from "../assets/memes/agarwojindahote.jpg";
import ignoredReply from "../assets/memes/hamerayhaaisahehotahai.jpg";
import noWay from "../assets/memes/noway.jpeg";
import streetDogs from "../assets/memes/ledogs.png";
import overthink from "../assets/memes/overthink.jpeg";
import nationalPainting from "../assets/memes/nationalpainting.jpeg";
import mentalHealthnow from "../assets/memes/mentalhealthnow.jpeg";
import idontJudge from "../assets/memes/idontjudge.jpeg";
import iplCameraMan from "../assets/memes/iplcameraman.jpeg";
import forGfforFriend from '../assets/memes/forgirlfriendforfriend.jpeg';
import meAtmyWedding from '../assets/memes/meatmywedding.jpeg';
// import financialCondn from '../assets/memes/financialrightnow.jpeg'

// import gadiNikal from '../assets/memes/gadinikal.jpg'


export const memes = [
  {
    id: 1,
    title: "Ab Mai Kya Bolu",
    image: "https://res.cloudinary.com/dntclntau/image/upload/v1775899746/abkyabolumai_vngxp9.jpg",
    keywords: ["ab", "mai", "kya bolu", "kha fas gya bhai mai", "awkward", "speechless", "reply"],
    mood: "awkward",
    category: "Reply",
  },
  {
    id: 2,
    title: "Homework Panic",
    image: homeworkPanic,
    keywords: ["teacher", "assignment", "homework", "study", "school", "panic"],
    mood: "panic",
    category: "School",
  },
  {
    id: 3,
    title: "Ignored Reply",
    image: ignoredReply,
    keywords: ["ignored", "seen", "crush", "late reply", "ghosted", "reply"],
    mood: "sad",
    category: "Chat",
  },
  {
    id: 4,
    title: "No Way",
    image: noWay,
    keywords: ["no way", "shock", "impossible", "disbelief", "reaction"],
    mood: "reaction",
    category: "Reaction",
  },
  {
    id: 5,
    title: "Street Dogs",
    image: streetDogs,
    keywords: ["dogs", "funny", "reaction", "animal", "meme"],
    mood: "funny",
    category: "Funny",
  },

  {
    id:6,
    title: "Overthink",
    image: overthink,
    keywords: ["overthink", "my overthinking level", "extra thinking", "reaction"],
    mood: "overthink",
    category: "Funny",
  
  },
  {id:7,
    title: "National Painting",
    image: nationalPainting,
    keywords: ["painting" , "national" , "notalgia" , "school" ],

    mood:'nostalgia',
    category:"Nostalgia"
  },
  {id:8,
    title: "Mental Health Now",
    image:mentalHealthnow,
    keywords: ["mental health" , "calculation" , "school time calculation" ,"Maths" ],

    mood:'logic',
    category:"Schoool"
  },
  {
    id:9,
    title:"I dont judge",
    image:idontJudge,
    keywords:['judge' , 'game' , 'we say and we dont judge'],
    mood:'Play',
    category:'Fun'
  

  }
  ,
  {
    id:10,
    title:"IPL Camera Man",
    image:iplCameraMan,
    keywords:['ipl' , 'cameraman', 'girls', 'beauty' , 'cricket'],
    mood:'Roast',
    category:'Roast'

  }
  ,{
    id:11,
    title:"For Girlfriend For Friend",
keywords:['gf' , 'bf' , 'after gf friend be like'],
mood:'Fun',
category:'Fun',
image:forGfforFriend

  }
  ,{
    id:12,
    title:"Me at my wedding",
  keywords :['ex' , 'marraige' , 'jealous' ,'white' ],
mood:'Jealouos',
category:'Jealouos',
image:meAtmyWedding
  },
  // {
  //   id:13,
  //   title:'Financial condition right now',
  //   keyword:['paisa' ,'broken' , 'finance' ,'poor'],
  //   image:financialCondn,
  //   category:'Fun',
  //   mood:'Fun'
  // }
  {
    id:13,
    title:'Gadi nikal',
    keywords:['chal' ,'gadi' , 'nikal' ,'poor'],
    image:"https://res.cloudinary.com/dntclntau/image/upload/v1775899746/gadinikal_uhqngg.jpg",
    category:'Fun',
    mood:'Fun'
  }
];