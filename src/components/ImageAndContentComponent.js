import React from "react";
import Content from "./Content";

function ImageAndContentComponent({
  title,
  description,
  description2,
  buttonText,
  sectionImage,
  type,
  contentType,
  buttonGoToPage,
}) {
  const getSectionImage = () => {
    if (sectionImage) {
      return sectionImage;
    }

    return "https://htmlcolorcodes.com/assets/images/colors/baby-blue-color-solid-background-1920x1080.png";
  };

  return (
    <div
      className={`p-[16px] sm:p-[40px] lg:p-[60px] flex flex-col justify-between items-center ${
        type === "reverse"
          ? "lg:items-center lg:flex-row-reverse"
          : "lg:items-center lg:flex-row"
      }  `}
    >
      <Content
        wrapperClassName={` w-11/12 lg:w-1/3 h-full ${
          type === "reverse" ? "" : "lg:mr-16"
        }`}
        contentType={contentType}
        title={title}
        description={description}
        description2={description2}
        buttonText={buttonText}
        url={buttonGoToPage}
      />

      <img
        alt="pills"
        src={`${getSectionImage()}`}
        className={`${
          type === "reverse" ? "lg:mr-16" : ""
        } w-full lg:w-4/6 h-[300px] md:h-[450px] mt-5 lg:mt-0 object-cover`}
      />
    </div>
  );
}

export default ImageAndContentComponent;
