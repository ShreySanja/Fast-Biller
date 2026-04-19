import { useState } from "react";

const gstStateMap = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman & Diu (Old)", "26": "Dadra & Nagar Haveli & Daman & Diu",
  "27": "Maharashtra", "28": "Andhra Pradesh (Old)", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh", "97": "Other territory", "99": "Centre Jurisdiction"
};

// Reverse map for state name -> code lookup
const stateNameToCode = Object.entries(gstStateMap).reduce((acc, [code, name]) => {
  acc[name.toLowerCase()] = code;
  return acc;
}, {});

const GSTStateInput = ({ widthOfInput, className, value, onChange, onFocus }) => {
  const [suggestion, setSuggestion] = useState("");

  const handleChange = (e) => {
  const input = e.target.value.trim();

  // If full state name is entered, replace with code automatically
  const lowerInput = input.toLowerCase();
	  if (stateNameToCode[lowerInput]) {
		onChange(`${stateNameToCode[lowerInput]}-${gstStateMap[stateNameToCode[lowerInput]]}`);
		setSuggestion(""); // Clear suggestion
		return;
	  }

	  onChange(input);

	  let suggestionText = "";

	  // Check if input matches a state code
	  const code = input.slice(0, 2);
	  if (gstStateMap[code]) {
		suggestionText = `${code}-${gstStateMap[code]}`;
	  }

	  setSuggestion(suggestionText);
	};


  const handleKeyDown = (e) => {
    if (e.key === "Tab" && suggestion) {
      e.preventDefault();
      onChange(suggestion); // Auto-complete on Tab
      setSuggestion("");
    }
  };


  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <input
        type="text"
        className={className}
        onFocus={onFocus }
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{ fontSize: '14px', width: widthOfInput }}
        placeholder=""
      />
      {suggestion && (
        <span style={{
          position: "absolute",
          left: "2.3px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "gray",
          pointerEvents: "none",
          fontSize: '14px'
        }}>
          {suggestion}
        </span>
      )}
    </div>
  );
};

export default GSTStateInput;
