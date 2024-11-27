import React from "react";

function Footer() {
  return (
    <div className="bg-primary-blue text-[.75em]">
      <div
        className="flex flex-col items-center justify-between px-[60px] py-[40px] 
      lg:flex-row"
      >
        <div className="w-full lg:w-1/2 text-center lg:text-justify flex flex-col justify-between mb-10 lg:mb-0">
          <div
            className=" flex flex-col justify-center items-center mb-10
            lg:flex-row
            lg:items-start 
            lg:justify-between "
          >
            <div className="flex flex-col text-white  mb-5 lg:mb-0">
              <h5 className="text-blue-200 font-medium  mb-[7px]">Title1</h5>
              <p className="cursor-pointer hover:underline">subtitle</p>
              <p className="cursor-pointer hover:underline">subtitle</p>
              <p className="cursor-pointer hover:underline">subtitle</p>
            </div>

            <div className="flex flex-col text-white  mb-5 lg:mb-0">
              <h5 className="text-blue-200 font-medium  mb-[7px]">Title2</h5>
              <p className="cursor-pointer hover:underline">subtitle</p>
              <p className="cursor-pointer hover:underline">subtitle</p>
            </div>

            <div className="flex flex-col text-white">
              <h5 className="text-blue-200 font-medium mb-[7px]">Title3</h5>
              <p className="cursor-pointer hover:underline">subtitle</p>
              <p className="cursor-pointer hover:underline">subtitle</p>
              <p className="cursor-pointer hover:underline">subtitle</p>
            </div>
          </div>

          <h5 className="text-blue-200 font-medium">© 2024 by SportiveHub</h5>
        </div>
      </div>
    </div>
  );
}

export default Footer;
