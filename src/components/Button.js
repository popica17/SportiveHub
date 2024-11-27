import React from "react";

function Button({ children, onClick, variant }) {
  const getVariant = () => {
    if (variant == "secondary") {
      return "btn btn-secondary";
    }
    if (variant == "hero") {
      return "btn-hero";
    }
    return "btn btn-primary";
  };
  return (
    <button onClick={onClick} className={getVariant()}>
      {children}
    </button>
  );
}
export default Button;
