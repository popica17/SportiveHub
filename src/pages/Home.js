import React from "react";
import { Link } from "react-router-dom";
import HeroComponent from "../components/HeroComponent";
import heroPicture from "../assets/hero.jpg";
import img2Picture from "../assets/img2.jpg";
import ImageAndContentComponent from "../components/ImageAndContentComponent";
import turneePicture from "../assets/turnee2.jpg";
import clasamentePicture from "../assets/clasament.png";
function Home() {
  return (
    <div>
      <HeroComponent
        height={800}
        title="SportiveHub gestionati turneele sportive cu usurinta"
        description={
          " Organizati si monitorizati turnee sportive cu ajutorul unei platforme simple si eficiente. De la programare, scoruri, pana la clasamente."
        }
        backgroundImage={heroPicture}
        buttonText={"Incepe acum"}
        url="/register"
      />
      <ImageAndContentComponent
        title="Organizare turnee"
        description={
          "Organizati turnee sportive cu usurinta. Programati meciurile, adaugati echipele si jucatorii, si monitorizati scorurile in timp real."
        }
        buttonText={"Incepe acum"}
        sectionImage={turneePicture}
        buttonGoToPage="/register"
      />
      <ImageAndContentComponent
        title=" Clasamente si statistici"
        description="Monitorizati clasamentele si statisticile echipei dumneavoastra. Aflati care sunt cele mai bune echipe si jucatori."
        buttonText="Incepe acum"
        sectionImage={clasamentePicture}
        buttonGoToPage="/register"
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
