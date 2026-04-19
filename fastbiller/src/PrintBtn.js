import React from "react";

const PrintBtn = ({
    htmlContent,
    companyName = "",
    partyName = "All Parties",
    dateFrom,
    dateTo,
    isLedger = false,
    buttonText = "Print"
}) => {
    const handlePrint = () => {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print</title>
                        <style>
                            @page {
                                size: auto;
                                margin: 0mm;
                            }
                            body { 
                                font-family: Arial, sans-serif; 
                                margin: 10mm 15mm; /* Add some margin for content */
                            }
                            h3 { text-align: center; margin-bottom: 5px; }
                            p { text-align: center; margin-bottom: 15px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid black; padding: 4px; text-align: left; }
                        </style>
                    </head>
                    <body>
                        ${isLedger ? `
                            <h3>${companyName}</h3>
                            <p>Ledger Of: ${partyName} (From: ${dateFrom || "Start"} To: ${dateTo || "End"})</p>
                        ` : ""}
                        ${htmlContent}
                        <script>
                            // Focus and print when content loads
                            window.onload = function() {
                                setTimeout(function() {
                                    window.print();
                                    window.onafterprint = function() {
                                        window.close();
                                    };
                                }, 200);
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        } else {
            alert("Pop-up blocked! Please allow pop-ups to print.");
        }
    };

    return (
        <button
            className="btn print-btn"
            onClick={handlePrint}
            style={{
                padding: "8px 16px",
                color: "#fff",
                border: "none",
                cursor: "pointer",
            }}
        >
            🖨️ {buttonText}
        </button>
    );
};

export default PrintBtn;