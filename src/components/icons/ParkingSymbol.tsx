import * as React from "react";

function ParkingSymbol(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 17H7.5a3.5 3.5 0 0 1 0-7H13" />
      <path d="M13 13h-1.5a3.5 3.5 0 0 0 0-7H9" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export default ParkingSymbol;
