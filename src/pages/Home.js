import React from "react";
import { Link } from "react-router-dom";
import HeroComponent from "../components/HeroComponent";
import heroPicture from "../assets/hero.png";
import img2Picture from "../assets/img2.jpg";
import ImageAndContentComponent from "../components/ImageAndContentComponent";
import turneePicture from "../assets/turnee2.jpg";
import clasamentePicture from "../assets/clasament.png";
import testPicture from "../assets/test.png";
function Home() {
  return (
    <div>
      <HeroComponent
        height={800}
        title="SportiveHub "
        description={
          " Organize and monitor sports tournaments with the help of a simple and efficient platform."
        }
        backgroundImage={heroPicture}
        buttonText={"Incepe acum"}
        url="/register"
      />
      <ImageAndContentComponent
        title="What is Sportivehub?"
        description={
          "Sportivehub is a digital application for managing and monitoring sports tournaments, designed to simplify competition organization and enhance the experience for all participants. The platform enables organizers to schedule, manage, and track matches, standings, and athlete performance in real time. Regardless of the sport, Sportivehub provides the essential tools for efficient, transparent, and modern event management."
        }
        buttonText={"Incepe acum"}
        sectionImage={testPicture}
        buttonGoToPage="/tournaments"
      />
      <ImageAndContentComponent
        title=" Clasamente si statistici"
        description="Monitorizati clasamentele si statisticile echipei dumneavoastra. Aflati care sunt cele mai bune echipe si jucatori."
        buttonText="Incepe acum"
        sectionImage={clasamentePicture}
        buttonGoToPage="/ranking"
        type="reverse"
      />
      <ImageAndContentComponent
        title=" Ce este SportiveHub?"
        description={
          "SportiveHub este o platforma care va ajuta sa organizati si monitorizati turnee sportive. De la programare, scoruri, pana la clasamente."
        }
        sectionImage={img2Picture}
      />
    </div>
  );
}
export default Home;
