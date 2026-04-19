import React, { useState, useRef, useEffect, useMemo, createContext, useCallback } from "react";
import axios from "axios";

export function InvoiceBody({ items, setItems, addNewRow, removeRow, updateAllGST, handleItemChange, layout, setLayout }) {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [error, setError] = useState("");
    
    const toggleSettings = () => {
        setIsSettingsOpen(!isSettingsOpen);
    };

    

    // Function to generate unique column names
    const generateUniqueColumnName = (baseName) => {
        let name = baseName;
        let counter = 1;
        while (layout.some((col) => col.name === name)) {
            name = `${baseName}${counter}`;
            counter++;
        }
        return name;
    };

    // Function to check for duplicate labels
    const hasDuplicateLabels = (newLayout) => {
        const labels = newLayout.map((col) => col.label);
        return new Set(labels).size !== labels.length;
    };

    // Function to update items when layout changes
    const updateItemsForLayout = useCallback((newLayout) => {
        setItems((prevItems) =>
            prevItems.map((item) => {
                const newItem = { ...item };
                newLayout.forEach((col) => {
                    if (!newItem.hasOwnProperty(col.name)) {
                        // Add new column to the item
                        newItem[col.name] = col.type === "number" && col.isReadOnly ? 0 : "";
                    }
                });
                // Remove columns that no longer exist in the layout (except amountWithGST)
                Object.keys(newItem).forEach((key) => {
                    if (key !== "amountWithGST" && !newLayout.some((col) => col.name === key)) {
                        delete newItem[key];
                    }
                });
                return newItem;
            })
        );
    }, [setItems]);

    // Function to generate unique column labels
    const generateUniqueColumnLabel = (baseLabel) => {
        let label = baseLabel;
        let counter = 1;
        while (layout.some((col) => col.label === label)) {
            label = `${baseLabel}${counter}`;
            counter++;
        }
        return label;
    };

    // Add a new column
    const addColumn = (index = null) => {
        setLayout((prevLayout) => {
            const newColumn = {
                name: generateUniqueColumnName("custom"),
                label: generateUniqueColumnLabel("New Column"), // Ensure unique label
                type: "text",
                align: "left",
                width: "100px",
                isReadOnly: false,
                isMandatory: false,
                calculate: "", // Add calculate field
            };
            const newLayout = index === null ? [...prevLayout, newColumn] : [
                ...prevLayout.slice(0, index + 1),
                newColumn,
                ...prevLayout.slice(index + 1),
            ];
            setError(""); // Clear any previous errors
            updateItemsForLayout(newLayout);
            return newLayout;
        });
    };

    // Remove a column
    const removeColumn = (index) => {
        setLayout((prevLayout) => {
            const newLayout = prevLayout.filter((_, i) => i !== index);
            if (hasDuplicateLabels(newLayout)) {
                setError("Two columns cannot have the same label.");
                return prevLayout;
            }
            setError("");
            updateItemsForLayout(newLayout);
            return newLayout;
        });
    };

    // Update a column
    const updateColumn = (index, key, value) => {
        setLayout((prevLayout) => {
            const newLayout = prevLayout.map((col, idx) =>
                idx === index ? { ...col, [key]: value } : col
            );
            if (key === "label" && hasDuplicateLabels(newLayout)) {
                setError("Two columns cannot have the same label.");
                return prevLayout;
            }
            setError("");
            updateItemsForLayout(newLayout);
            return newLayout;
        });
    };

    // Toggle ReadOnly
    const toggleReadOnly = (index) => {
        setLayout((prevLayout) => {
            const newLayout = [...prevLayout];
            newLayout[index].isReadOnly = !newLayout[index].isReadOnly;
            return newLayout;
        });
    };

    // Handle Calculate Formula
    const handleCalculateFormula = (index, formula) => {
        setLayout((prevLayout) => {
            const newLayout = [...prevLayout];
            newLayout[index].calculate = formula;
            return newLayout;
        });
    };

    const handleWidthChange = (index, value) => {
        const newWidth = `${value}px`;
        updateColumn(index, "width", newWidth);
    };

    const handleUpdate = () => {
        // Validate layout or perform any necessary updates
        setError(""); // Clear any previous errors
        toggleSettings(); // Close the settings overlay
    };

    const [focusedRow, setFocusedRow] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);

    const gridStyle = useMemo(() => ({
        display: "grid",
        gridTemplateColumns: layout.map(col => col.width).join(" "),
        borderBottom: "1px solid #ccc",
    }), [layout]);




    useEffect(() => {
        // Calculate total width
        const totalWidth = layout.reduce((sum, col) => sum + parseInt(col.width), 0);

        // Set error message if total width exceeds 940
        if (totalWidth > 940) {
            setError("Total width should not be more than 940");
        } else {
            setError(""); // Clear error when total width is within limit
        }
    }, [layout]); // Runs whenever layout changes

    

    const [itemNames, setItemNames] = useState([]);

    useEffect(() => {
        const fetchItemData = async () => {
            try {
                const response = await axios.post(`${API_BASE_URL}/getitemdata`, {
                    query: {}
                });

                const itemSet = new Set();

                response.data.forEach(item => {
                    if (item.ItemName) itemSet.add(item.ItemName);
                });

                setItemNames([...itemSet]);
            } catch (err) {
                console.error("Failed to fetch item data:", err);
            }
        };

        fetchItemData();
    }, []);

    return (
        <>
            <datalist id="ItemName">
                {itemNames.map((val, i) => (
                    <option key={i} value={val} />
                ))}
            </datalist>


            <div className="invoice-body" style={{ height: "100mm", position: "relative" }}>
                <div className="body-header" style={gridStyle}>
                    {layout.map((col) => (
                        <div key={col.name} style={{ textAlign: col.align, width: col.width }}>{col.label}</div>
                    ))}
                </div>
                {items.map((item, index) => (
                    <div
                        className="body-row"
                        key={index}
                        style={gridStyle}
                        onMouseEnter={() => setFocusedRow(index)}
                        onMouseLeave={() => setFocusedRow(null)}
                    >
                        {layout.map((col) => {
                            const isProductField = col.name === 'productName';
                            const listId = isProductField ? 'ItemName' : undefined;

                            return (
                                <div key={col.name} style={{ width: col.width, textAlign: col.align }}>
                                    <input
                                        className={`no-negative inFocusQueue`.trim()}
                                        type={col.type}
                                        value={item[col.name] || ""}
                                        onChange={(e) => handleItemChange(index, col.name, e.target.value, layout)}
                                        placeholder={col.label}
                                        style={{ textAlign: col.align, width: "100%" }}
                                        readOnly={col.isReadOnly}
                                        list={listId}
                                    />
                                </div>
                            );
                        })}




                        
                        {focusedRow === index && (
                            <div
                                style={{width:'50px'} }
                                className="action-buttons"
                                onMouseEnter={() => setHoveredRow(index)}
                                onMouseLeave={() => setHoveredRow(null)}
                            >
                                <button className="delete-action-button"  style={{ cursor: "pointer" }} onClick={() => removeRow(index)}>🗑️</button>
                            </div>
                        )}
                    </div>
                ))}
                <div className="add-row-container">
                    <button className="add-row-button" onClick={addNewRow} disabled={items.length >= 10}>+</button>
                    <button className="settings-button" onClick={toggleSettings}>⚙️</button>
                </div>
            </div>

            {/* Settings Overlay */}
            {isSettingsOpen && (
                <div className="settings-overlay" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: 1000 }}>
                    <div className="settings-content" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", padding: "20px", borderRadius: "8px", width: "1100px" }}>
                        <button className="close-settings" onClick={toggleSettings} style={{ position: "absolute", top: "10px", right: "10px", cursor: "pointer" }}>✖</button>
                        <h3>Settings</h3>
                        <p style={{ fontSize: '16px' }}>Customize your invoice layout here.</p>
                        <p style={{ fontSize: '14px', color: 'gray' }}>Note:- All the fields that does not have remove button are mandatory fields. (Try not to make any changes in them)</p>
                        <p style={{ fontSize: '14px', color: 'gray' }}>Warning:- use Inv_No insted of Inv No when using Calculate column.(to access any field with space in it)</p>

                        {/* Table Structure */}
                        <div className="container">
                            <h2 className="title">Product Table Layout</h2>
                            <div className="button-group" style={{ marginBottom: "10px" }}>
                                <button onClick={() => addColumn(-1)} className="add-field">Add Field</button>
                            </div>
                            <div className="table-container">
                                <table border="1" style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr>
                                            <th>Label</th>
                                            <th style={{ width: "250px" }}>Type</th>
                                            <th style={{ width: "250px" }}>Align</th>
                                            <th style={{ width: "200px" }}>Width</th>
                                            <th style={{ width: "100px" }}>ReadOnly</th>
                                            <th style={{ width: "200px" }}>Calculate</th>
                                            <th style={{ width: "200px" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {layout.map((col, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={col.label}
                                                        onChange={(e) => updateColumn(index, "label", e.target.value)}
                                                        className="table-input"
                                                        style={{ width: "95%" }}
                                                        readOnly={["SrNo", "Product Name", "HSN", "Qty", "Rate", "Unit", "GST%", "Amount"].includes(col.label)}
                                                    />
                                                </td>
                                                <td style={{ width: "250px" }}>
                                                    <select
                                                        value={col.type}
                                                        onChange={(e) => updateColumn(index, "type", e.target.value)}
                                                        className="table-select"
                                                        style={{ width: "100%" }}
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="number">Number</option>
                                                    </select>
                                                </td>
                                                <td style={{ width: "100px" }}>
                                                    <select
                                                        value={col.align}
                                                        onChange={(e) => updateColumn(index, "align", e.target.value)}
                                                        className="table-select"
                                                        style={{ width: "100%" }}
                                                    >
                                                        <option value="left">Left</option>
                                                        <option value="center">Center</option>
                                                        <option value="right">Right</option>
                                                    </select>
                                                </td>
                                                <td style={{ width: "90px" }}>
                                                    <input
                                                        type="number"
                                                        value={String(col.width).replace(/px$/, '')}
                                                        onChange={(e) => handleWidthChange(index, e.target.value)}
                                                        style={{ width: "90%" }}
                                                    />
                                                </td>
                                                <td style={{ width: "100px" }}>
                                                    <button onClick={() => toggleReadOnly(index)}>
                                                        {col.isReadOnly ? "Yes" : "No"}
                                                    </button>
                                                </td>
                                                <td style={{ width: "600px" }}>
                                                    <input
                                                        type="text"
                                                        value={col.calculate || ""}
                                                        onChange={(e) => handleCalculateFormula(index, e.target.value)}
                                                        style={{ width: "100%" }}
                                                        disabled={col.isMandatory}
                                                        placeholder={col.label === "Amount" ? "Qty * Rate" : ""}
                                                    />
                                                </td>
                                                <td style={{ width: "400px" }}>
                                                    <button onClick={() => addColumn(index)} style={{ marginLeft: "10px" }}>Add ⬇</button>
                                                    {!col.isMandatory && (
                                                        <button onClick={() => removeColumn(index)} className="remove-button">
                                                            Remove
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {error && <p style={{ color: 'red' }}>⚠️ {error} ⚠️</p>}

                            <div className="button-group" style={{ marginTop: "20px" }}>
                                <button onClick={() => addColumn()} className="add-field">Add Field</button>
                                <button onClick={handleUpdate} className="update-button">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default InvoiceBody;