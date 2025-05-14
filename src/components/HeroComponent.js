import React from "react";
import Button from "./Button";
import { useNavigate } from "react-router-dom";

function HeroComponent({
  title,
  description,
  buttonText,
  backgroundImage,
  height,
  wrapperClassName,
  contentClassName,
  buttonVariant,
  url,
}) {
  const navigate = useNavigate();

  const getBackgroundColor = () => {
    if (backgroundImage) {
      return `bg-[url('https://c0.wallpaperflare.com/path/896/663/732/adult-biology-chemical-chemist-7a2f2b5e6a080c94b1045e9d9ddcf101.jpg')]`;
    }
    return "bg-gradient-to-r from-cyan-500 to-blue-500";
  };

  return (
    <div
      className={`${getBackgroundColor()} cursor-default bg-center bg-cover bg-no-repeat duration-500
      bg-gradient-to-tr from-gray-600 to-gray-600 w-full m-auto
      flex justify-center items-center 
      z-10 relative
      before:content-['']
      before:absolute
      before:inset-0
      before:block
      before:bg-gradient-to-tr
      before:from-gray-500
      before:to-gray-600
      before:opacity-40
      before:z-[-5]
      ${wrapperClassName}
      `}
      style={{
        backgroundImage: `${backgroundImage ? `url(${backgroundImage})` : ""}`,
        height: height,
      }}
    >
      <div
        className={`flex flex-col justify-center items-center text-white p-10 ${contentClassName}`}
      >
        <h1 className="max-w-7xl mx-auto text-4xl md:text-5xl lg:text-6xl drop-shadow mb-5 font-bold text-center">
          {title}
        </h1>
        {description && (
          <p className="max-w-4xl mx-auto text-center text-base lg:text-lg drop-shadow font-medium mb-10 px-16">
            {description}
          </p>
        )}

        {buttonText && (
          <Button
            onClick={() => navigate(url)}
            variant={`${buttonVariant === "secondary" ? "secondary" : "hero"}`}
          >
            {buttonText}
          </Button>
        )}
      </div>
    </div>
  );
}

export default HeroComponent;
