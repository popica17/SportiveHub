import React from "react";
import Button from "./Button";
import { useNavigate } from "react-router-dom";

function Content({
  title,
  description,
  description2,
  buttonText,
  wrapperClassName,
  contentClassName,
  buttonVariant,
  contentType,
  descriptionColor,
  url,
}) {
  const navigate = useNavigate();

  return (
    <div className={`${wrapperClassName}`}>
      <div className={`${contentClassName} `}>
        <h2
          className={`text-xl lg:text-2xl xl:text-3xl  ${
            contentType === "secondary"
              ? "text-white drop-shadow"
              : "text-primary-color"
          }  font-bold mb-6`}
        >
          {title}
        </h2>
        <p
          className={`${
            contentType === "secondary"
              ? "text-white drop-shadow"
              : `${descriptionColor} md:text-black`
          }  text-sm xl:text-base font-medium mb-6`}
        >
          {description}
        </p>
        {description2 && (
          <p
            className={`${
              contentType === "secondary"
                ? "text-white"
                : `${descriptionColor} md:text-black`
            }  text-sm xl:text-base  font-medium mb-6`}
          >
            {description2}
          </p>
        )}
        {buttonText && (
          <Button
            onClick={() => navigate(url)}
            variant={`${
              contentType === "secondary" ? "secondary" : buttonVariant
            }`}
          >
            {buttonText}
          </Button>
        )}
      </div>
    </div>
  );
}

export default Content;
