import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import "./InvoiceLayout.css";
import GSTStateInput from "./GSTStateInput";
import InvoiceBody from "../layouts/InvoiceBody";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import InvoiceStore from '../Settings/InvoiceStore';
import { useLocation } from "react-router-dom";

function Layout1({ layout, setLayout, updateLayoutOnServer }) {
	const location = useLocation();
	const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
	const [OldID, setOldID] = useState("");
	// Mandatory selects
	const [memoType, setMemoType] = useState("Debit Memo");
	const [salesType, setSalesType] = useState("Local Sales");
	const [invoiceType, setInvoiceType] = useState("Tax Invoice");
	const [copyType, setCopyType] = useState("Original");

	// Example state for top fields
	const [companyName, setCompanyName] = useState("");
	const [companyAddress, setCompanyAddress] = useState("");
	const [companyGSTIN, setCompanyGSTIN] = useState("");
	const [billDate, setBillDate] = useState("");
	const [buyerPartyName, setbuyerPartyName] = useState("");
	const [shipPartyName, setShipPartyName] = useState("");
	const [buyerPartyAddr, setbuyerPartyAddr] = useState("");
	const [shipPartyAddr, setShipPartyAddr] = useState("");
	const [transpDetail, setTranspDetail] = useState("");
	const [invoiceNo, setInvoiceNo] = useState("");
	const [fullInvoiceNo, setFullInvoiceNo] = useState("");
	const today = new Date();
	const [invoiceDate, setInvoiceDate] = useState(
		today.toLocaleDateString("en-GB").split("/").reverse().join("-") // Convert to DD-MM-YYYY
	);
	const navigate = useNavigate();

	const [invoiceLayout, setInvoiceLayout] = useState(InvoiceStore.getInvoiceLayout());
	useEffect(() => {
		const unsubscribe = InvoiceStore.subscribe(({ invoiceLayout }) => {
			setInvoiceLayout(invoiceLayout);
		});
		return unsubscribe;
	}, []);

	const [allFullInvoiceNos, setAllFullInvoiceNos] = useState([]);

	//sync billto shipto
	const [isShipToModified, setIsShipToModified] = useState(false);

	// Refs to track previous values
	const prevBuyerPartyName = useRef('');
	const prevBuyerPartyAddr = useRef('');
	const prevBillToGSTState = useRef('');
	const prevBillToGSTIN = useRef('');

	useEffect(() => {
		const fetchLatestInvoiceNo = async () => {
			if (!invoiceLayout) return;

			try {
				const response = await fetch(`${API_BASE_URL}/getLatestInvoiceNo`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ layout: invoiceLayout })
				});

				const data = await response.json();
				if (data.fullInvoiceNo) {
					const numberMatch = data.fullInvoiceNo.match(/\d+(?=\D*$)/);
					const newInvNo = numberMatch ? numberMatch[0] : "";

					setInvoiceNo(newInvNo);
					setFullInvoiceNo(data.fullInvoiceNo);
					setAllFullInvoiceNos(data.allFullInvoiceNos || []);

					handleInvoiceChange({ target: { value: data.fullInvoiceNo } });
				}
			} catch (error) {
				console.error("Error fetching latest invoice no:", error);
			}
		};

		fetchLatestInvoiceNo();
	}, [invoiceLayout]);

	

	//fetch sales data based on given id
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const idFromUrl = params.get("id");

		setOldID(idFromUrl);
		if (idFromUrl) {
			fetchSalesData(idFromUrl);
		}
	}, [location.search]);

	const fetchSalesData = async (id) => {
		try {
			const response = await fetch(`${API_BASE_URL}/getsalesdata`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idOfSales: id }),
			});
			const salesData = await response.json();
			if (!salesData.length) return;

			const sale = salesData[0];

			setCompanyAddress(sale.CmpAddr);
			setCompanyGSTIN(sale.CmpGSTIN);

			setMemoType(sale.MemoType || "Debit Memo");
			setInvoiceType(sale.InvType || "Tax Invoice");
			setCopyType(sale.CopyType || "Original");
			setTranspDetail(sale.TransportDetails || "");
			const gotDate = new Date(sale.InvDate).toLocaleDateString("en-GB").split("/").reverse().join("-");
			setInvoiceDate(
				sale.InvDate ? gotDate : ""
			);
			setLayout(sale.BodyLayout);



			// Sample field mappings – adjust these based on your schema
			setbuyerPartyName(sale.BillToPartyName || "");
			setShipPartyName(sale.ShipToPartyName || "");
			setbuyerPartyAddr(sale.BillToAddressDetails?.Addr || "");
			setShipPartyAddr(sale.ShipToAddressDetails?.Addr || "");
			setBillToGSTIN(sale.BillToAddressDetails?.GSTIN || "");
			setShipToGSTIN(sale.ShipToAddressDetails?.GSTIN || "");
			setBillToGSTState(sale.BillToAddressDetails?.PartyStateAndCode || "");
			setShipToGSTState(sale.ShipToAddressDetails?.PartyStateAndCode || "");

			setItems(
				sale.SalesDetails?.map((item, index) => {
					const extraFields = item.ExtraItemValues || {};
					console.log('extraField:-' + JSON.stringify(extraFields)); // ✅ Logs as string
					console.log('items:-' + JSON.stringify(items));
					console.log('layout:-' + JSON.stringify(layout));
					return {
						srNo: index + 1,
						productName: item.ProductName || "",
						hsn: item.HSNCode || "",
						qty: item.Qty || "",
						rate: item.Rate || "",
						unit: item.Unit || "",
						gst: item.GST || "",
						amount: item.Value || 0,
						amountWithGST: item.AmountWithGST || 0,
						...extraFields  // dynamically add extra keys like "New Column": "Hell Yah"
					};
				}) || [
					{
						srNo: 1,
						productName: "",
						hsn: "",
						qty: "",
						rate: "",
						unit: "",
						gst: "",
						amount: 0,
						amountWithGST: 0
					}
				]
			);




			//setInvoiceDate(sale.InvoiceDate?.split("T")[0] || invoiceDate);
			setTranspDetail(sale.TransportDetails || "");
			setDiscount(parseFloat(sale.DiscountPer || "") || 0);
			setDiscountRs(sale.DiscountRs || "");
			setPackaging(sale.PackagingCharge || "");
			setRemark(sale.Remark || "");
			setSalesType(sale.SalesType || "Export Sales");
			//setBankName(sale.BankName || "");
			//setBankACNo(sale.BankACNo || "");
			//setBankBranch(sale.BankBranch || "");
			//setBankIfsc(sale.BankIFSC || "");

			setForCompany(sale.ForCompany || "");

			// Optionally update invoice no & layout
			const formattedInvoiceNo = sale.InvNoLayout?.replace(/{.*?}/g, sale.InvNo);
			setInvoiceNo(sale.InvNo);
			setInvoiceLayout(sale.InvNoLayout);
			setFullInvoiceNo(formattedInvoiceNo);

		} catch (error) {
			console.error("Error fetching sales data:", error);
		}
	};


	const [error, setError] = useState('');

	const handleInvoiceChange = (e) => {
		const value = e.target.value;
		setFullInvoiceNo(value);

		const layoutPattern = invoiceLayout || "";
		const match = layoutPattern.match(/^(.*)\{(0+)\}(.*)$/);

		if (!match) {
			setError("Invalid layout format");
			return;
		}

		const prefix = match[1];
		const suffix = match[3];

		const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)${escapeRegExp(suffix)}$`);
		const result = value.match(regex);

		if (result) {
			const numberPart = result[1];
			if (allFullInvoiceNos.includes(value)) {
				setError("This invoice number already exists.");
			} else {
				setInvoiceNo(numberPart);
				setError('');
			}
		} else {
			setInvoiceNo('');
			setError('Invoice number does not match the layout.');
		}
	};

	const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


	// Body rows (just a single row for demo)
	/*const [items, setItems] = useState([
	  {
		srNo: 1,
		productName: "",
		hsn: "",
		qty: "",
		rate: "",
		unit: "",
		amount: "",
	  },
	]);*/

	//state and code
	const [billToGSTState, setBillToGSTState] = useState("");
	const [shipToGSTState, setShipToGSTState] = useState("");

	const [billToGSTIN, setBillToGSTIN] = useState('');
	const [shipToGSTIN, setShipToGSTIN] = useState('');

	const [items, setItems] = useState([
		{ srNo: 1, productName: "", hsn: "", qty: "", rate: "", unit: "", gst: "", amount: 0, amountWithGST: 0 },
	]);

	// Callback to handle layout changes
	const handleLayoutChange = (newLayout) => {
		// This will automatically update the items state via the `updateItemsForLayout` function in InvoiceBody
	};



	// Bottom section
	const [discount, setDiscount] = useState("");
	const [discountRs, setDiscountRs] = useState("");
	let [totalWithDiscount, setTotalWithDiscount] = useState(0);
	const [packaging, setPackaging] = useState("");
	const [remark, setRemark] = useState("");
	const [bankName, setBankName] = useState("");
	const [bankACNo, setBankACNo] = useState("");
	const [bankBranch, setBankBranch] = useState("");
	const [bankIfsc, setBankIfsc] = useState("");
	const [cgst, setCgst] = useState("");
	const [sgst, setSgst] = useState("");
	const [igst, setIgst] = useState("");
	const [focusedRow, setFocusedRow] = useState(null);
	const [hoveredRow, setHoveredRow] = useState(null);

	const [terms, setTerms] = useState(
		"1) Goods once supplied will not be taken back or exchanged.\n2) Our Responsibility ceases on Delivery at Morbi factory.\n3) Insurance shall be covered by purchaser."
	);
	const [declaration, setDeclaration] = useState(
		"I Certified that particulars are true and correct, and the amount indicated represents the price actually charged and that there is no flow of additional consideration directly from buyer\nSubject to Morbi Jurisdiction Only. E & O.E"
	);
	const [forCompany, setForCompany] = useState("");

	// Calculate total from item rows
	const [total, setTotal] = useState(0);
	const [totalWithGST, setTotalWithGST] = useState(0);

	const calculatedTotal = useMemo(() =>
		items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
		[items]
	);

	const calculatedTotalWithGST = useMemo(() =>
		items.reduce((sum, item) => sum + (parseFloat(item.amountWithGST) || 0), 0),
		[items]
	);

	useEffect(() => {
		setTotal(calculatedTotal);
		setTotalWithGST(calculatedTotalWithGST);
	}, [calculatedTotal, calculatedTotalWithGST]); // Update state only when calculated values change




	// Calculate discount, packaging, insurance amounts
	const discountVal = discount ? -(total * (parseFloat(discount) / 100)) : 0;
	const packagingVal = packaging ? parseFloat(packaging) : 0;

	// Summation for final invoice value
	const subTotal = total + discountVal + packagingVal;
	const cgstVal = cgst ? parseFloat(cgst) : 0;
	const sgstVal = sgst ? parseFloat(sgst) : 0;
	const igstVal = igst ? parseFloat(igst) : 0;
	const grandTotal = subTotal + cgstVal + sgstVal + igstVal;

	// Convert total to words
	const numberToWords = (num, isInvWordInIndian = true) => {
		if (!num || isNaN(num)) return "";

		function convertToWordsRec(n, values, words) {
			let res = "";

			// Iterating over all key Numeric values
			for (let i = 0; i < values.length; i++) {
				let value = values[i];
				let word = words[i];

				// If the number is greater than or equal to the current numeric value
				if (n >= value) {
					// Append the quotient part
					if (n >= 100)
						res += convertToWordsRec(Math.floor(n / value), values, words) + " ";

					// Append the word for numeric value
					res += word;

					// Append the remainder part
					if (n % value > 0)
						res += " " + convertToWordsRec(n % value, values, words);

					return res;
				}
			}

			return res;
		}

		function convertToWords(n) {
			if (n === 0) return "Zero";

			// Define values and words based on Indian or International system
			let values, words;

			if (isInvWordInIndian) {
				// Indian numbering system (Lakh, Crore)
				values = [
					10000000, 100000, 1000, 100, 90, 80, 70, 60, 50, 40, 30, 20,
					19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
				];
				words = [
					"Crore", "Lakh", "Thousand", "Hundred", "Ninety", "Eighty", "Seventy",
					"Sixty", "Fifty", "Forty", "Thirty", "Twenty", "Nineteen", "Eighteen",
					"Seventeen", "Sixteen", "Fifteen", "Fourteen", "Thirteen", "Twelve",
					"Eleven", "Ten", "Nine", "Eight", "Seven", "Six", "Five", "Four", "Three",
					"Two", "One",
				];
			} else {
				// International numbering system (Million, Billion)
				values = [
					1000000000, 1000000, 1000, 100, 90, 80, 70, 60, 50, 40, 30, 20,
					19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
				];
				words = [
					"Billion", "Million", "Thousand", "Hundred", "Ninety", "Eighty", "Seventy",
					"Sixty", "Fifty", "Forty", "Thirty", "Twenty", "Nineteen", "Eighteen",
					"Seventeen", "Sixteen", "Fifteen", "Fourteen", "Thirteen", "Twelve",
					"Eleven", "Ten", "Nine", "Eight", "Seven", "Six", "Five", "Four", "Three",
					"Two", "One",
				];
			}

			return convertToWordsRec(n, values, words);
		}

		return convertToWords(Math.floor(num)) + (isInvWordInIndian ? ' Rupees' : '') + " Only";
	};


	const [fullProductList, setFullProductList] = useState([]);

	useEffect(() => {
		fetch(`${API_BASE_URL}/getitemdata`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query: {} })
		})
			.then((res) => res.json())
			.then((data) => {
				setFullProductList(data); // ✅ store all raw product data
			})
			.catch((err) => {
				console.error("Failed to fetch item data:", err);
			});
	}, []);

	// Change in qty, rate, or any other fields
	const handleItemChange = (index, field, value, currentLayout) => { // Rename layout to currentLayout
		const updatedItems = [...items];
		updatedItems[index][field] = value;

		if (field === "productName") {
			
			const selectedProduct = fullProductList.find(p => p.ItemName === value);
			if (selectedProduct) {
				// Preserve other fields, only overwrite known ones
				updatedItems[index] = {
					...updatedItems[index],
					unit: selectedProduct.Unit,
					hsn: selectedProduct.HSN,
					gst: selectedProduct.GSTPer
				};
			}
		}

		// Update GST and amount calculations
		if (field === "qty" || field === "rate" || field === "gst") {
			let qty = parseFloat(updatedItems[index].qty) || 0;
			let rate = parseFloat(updatedItems[index].rate) || 0;
			let gst = parseFloat(updatedItems[index].gst) || 0; // GST percentage

			let baseAmount = qty * rate;
			let totalGSTAmt = (baseAmount * gst) / 100; // Calculate GST

			updatedItems[index].amount = baseAmount; // Total amount without `.toFixed(2)`
			updatedItems[index].amountWithGST = totalGSTAmt; // GST Amount
		}

		// Evaluate calculate formulas for all columns
		currentLayout.forEach((col) => { // Use currentLayout instead of layout
			if (col.calculate) {
				try {
					// Replace column labels in the formula with their respective values
					const formula = col.calculate.replace(/[A-Za-z_]+/g, (match) => {
						// Replace underscores with spaces in the match
						const labelWithSpaces = match.replace(/_/g, ' ');
						// Find the column with the matching label
						const column = currentLayout.find((c) => c.label === labelWithSpaces);
						if (column) {
							return updatedItems[index][column.name] || 0;
						}
						return match; // If label not found, keep it as is
					});

					// Evaluate the formula
					updatedItems[index][col.name] = eval(formula);
				} catch (error) {
					console.error("Error evaluating formula:", error);
				}
			}
		});

		setItems(updatedItems);
		updateAllGST();
	};



	const addNewRow = () => {
		if (items.length < 10) {
			setItems((prevItems) => {
				const newRow = { srNo: prevItems.length + 1, productName: "", hsn: "", qty: "", rate: "", unit: "", gst: "", amount: 0, amountWithGST: 0 };
				const updatedItems = [...prevItems, newRow];

				setTimeout(() => {
					const inputs = document.querySelectorAll(".invoice-body input");
					const newProductInput = inputs[inputs.length - 8]; // Focus on new row's product input
					if (newProductInput) newProductInput.focus();
				}, 0);

				return updatedItems;
			});
		}
	};

	const removeRow = (index) => {
		setItems((prevItems) => prevItems.filter((_, i) => i !== index));
		autoUpdateSRNO();
		document.getElementById('sales-type').focus();
	};


	// Update discount Rs based on discount percentage
	const updateDiscountRs = () => {
		const discountInput = document.getElementById("discount");

		let discount = parseFloat(discountInput.value);
		setDiscount(discount);
		if (!isNaN(discount)) {
			setDiscountRs(((discount / 100) * total).toFixed(2)); // Update discount in Rs
		}
	};

	//update total whenever items change
	const totalAmount = useMemo(() => {
		return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
	}, [items]);

	useEffect(() => {
		setTotal(totalAmount);
	}, [totalAmount]);

	const updateAllGST = useCallback(() => {
		let discountRs = parseFloat(document.getElementById("discountRs").value) || 0; // Get discount in Rs
		let packagingCharges = parseFloat(packaging) || 0; // Get packaging charges

		let totalAmount = items.reduce((sum, item) => sum + item.amount, 0); // Sum of all product amounts
		let totalWithPackaging = totalAmount + packagingCharges; // Total including packaging

		if (totalWithPackaging === 0) return; // Prevent division by zero

		let newTotalWithDiscount = 0;
		const updatedItems = items.map((item) => {
			const sharePercentage = (item.amount / totalAmount) * 100;

			const packagingShare = (sharePercentage / 100) * packagingCharges;
			const amountWithPackaging = item.amount + packagingShare;

			const discountShare = (sharePercentage / 100) * discountRs;
			const discountedAmount = amountWithPackaging - discountShare;

			newTotalWithDiscount += discountedAmount;

			const gstAmount = (discountedAmount * item.gst) / 100;
			const amountWithGST = salesType === "Export Sales"
				? discountedAmount
				: discountedAmount + gstAmount;

			return { ...item, amountWithGST };
		});

		// ✅ Prevents unnecessary updates to `items`
		setItems((prevItems) => {
			const isSame = prevItems.every((item, index) =>
				item.amountWithGST === updatedItems[index].amountWithGST
			);

			return isSame ? prevItems : updatedItems;
		});

		// ✅ Prevents unnecessary updates to `setTotalWithDiscount`
		setTotalWithDiscount((prev) => (prev !== newTotalWithDiscount ? newTotalWithDiscount : prev));
	}, [items, packaging, discountRs, salesType]);

	useEffect(() => {
		updateAllGST();
	}, [updateAllGST]);

	const updateGSTAndRemoveDiscountPercentageField = (e) => {
		removeDiscountPercentage();
		updateAllGST();

		let value = parseFloat(e.target.value);

		if (!isNaN(value)) {
			value = parseFloat(value.toFixed(2)); // Convert back to number
		} else {
			value = 0; // Fallback for invalid input
		}

		setDiscountRs(value);
	};



	function removeDiscountPercentage() {
		const discountInput = document.getElementById("discount");
		const discountRsInput = document.getElementById("discountRs");

		if (discountRsInput && discountRsInput.value.trim() !== "" && !isNaN(discountRsInput.value)) {
			discountInput.value = "";
		}
	}


	const autoUpdateSRNO = () => {
		setItems((prevItems) =>
			prevItems.map((item, index) => ({
				...item,
				srNo: index + 1, // Assigning srNo dynamically
			}))
		);
	};

	// Move through elements using Enter and Shift + Enter
	useEffect(() => {
		const elements = document.querySelectorAll(".inFocusQueue");

		const handleKeyDown = (e) => {

			const currentIndex = Array.from(elements).indexOf(document.activeElement);
			const isTextArea = document.activeElement.tagName.toLowerCase() === "textarea";

			if (e.key === "Enter") {
				if (document.activeElement.classList.contains("address-suggestions")) {
					e.preventDefault();
					// 1️⃣ pick the suggestion
					const selected = addressSuggestions[highlightedPartyIndex];
					applySelectedSuggestion(selected);

					// 2️⃣ defer the focus move so it happens after React paints
					setTimeout(() => {
						const nextIndex = currentIndex + 1;
						if (nextIndex < elements.length) {
							elements[nextIndex].focus();
							elements[nextIndex].select?.();
						}
					}, 0);

					return;
				}

				if (isTextArea) {
					const textarea = document.activeElement;
					const textValue = textarea.value;
					const cursorStart = textarea.selectionStart;
					const cursorEnd = textarea.selectionEnd;
					const lines = textValue.split("\n");
					const isCursorOnLastLine = cursorStart === textValue.length;
					const isLastLineEmpty = lines.length > 1 && lines[lines.length - 1].trim() === "";
					const isAllTextSelected = cursorStart === 0 && cursorEnd === textValue.length;

					if (e.shiftKey) {
						// Shift + Enter moves backward
						e.preventDefault();
						const prevIndex = currentIndex - 1;
						if (prevIndex >= 0) {
							elements[prevIndex].focus();
							elements[prevIndex].select?.();
						}
					} else if (isAllTextSelected) {
						// If all text is selected, just move forward without adding a new line
						e.preventDefault();

						const nextIndex = currentIndex + 1;
						if (nextIndex < elements.length) {
							elements[nextIndex].focus();
							elements[nextIndex].select?.();
						}
					} else if (isCursorOnLastLine && isLastLineEmpty) {
						// If last line is empty, remove it safely and move forward
						e.preventDefault();

						// Preserve cursor position while updating value
						const newValue = lines.slice(0, -1).join("\n");
						textarea.value = newValue;

						// Manually trigger input event to update height correctly
						const inputEvent = new Event("input", { bubbles: true });
						textarea.dispatchEvent(inputEvent);

						const nextIndex = currentIndex + 1;
						if (nextIndex < elements.length) {
							elements[nextIndex].focus();
							elements[nextIndex].select?.();
						}
					} else {
						// Allow normal Enter to insert a new line
						return;
					}
				} else {
					// Normal input fields move forward or backward
					e.preventDefault();
					const newIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
					if (newIndex >= 0 && newIndex < elements.length) {
						elements[newIndex].focus();
						elements[newIndex].select?.();
					}
				}
			}
		};

		elements.forEach((el) => {
			el.addEventListener("keydown", handleKeyDown);
			el.addEventListener("focus", (e) => e.target.select?.());
		});

		return () => {
			elements.forEach((el) => {
				el.removeEventListener("keydown", handleKeyDown);
				el.removeEventListener("focus", (e) => e.target.select?.());
			});
		};
	}, [items]);




	const autoExpandTextareas = () => {
		const textareas = document.querySelectorAll(".autoExpand");

		const adjustHeight = (e) => {
			e.target.style.height = "auto"; // Reset height
			e.target.style.height = `${e.target.scrollHeight}px`; // Set to content height
		};

		// Attach event listener to each textarea
		textareas.forEach((textarea) => {
			textarea.removeEventListener("input", adjustHeight); // Avoid duplicate listeners
			textarea.addEventListener("input", adjustHeight);
			adjustHeight({ target: textarea }); // Adjust existing values on call
		});

		return () => {
			textareas.forEach((textarea) => textarea.removeEventListener("input", adjustHeight));
		};
	};


	//to auto expand textareas
	useEffect(() => {
		const cleanup = autoExpandTextareas();
		return cleanup;
	}, [items]);


	//expand bill to and ship to together
	useEffect(() => {
		const textareas = document.querySelectorAll(".expandTogether");

		const syncHeight = () => {
			let maxHeight = 0;

			// Reset height to auto to get the correct scrollHeight
			textareas.forEach((textarea) => {
				textarea.style.height = "auto"; // Reset before measuring
				maxHeight = Math.max(maxHeight, textarea.scrollHeight);
			});

			// Apply the max height to all textareas
			textareas.forEach((textarea) => {
				textarea.style.height = `${maxHeight}px`;
			});
		};

		textareas.forEach((textarea) => {
			textarea.addEventListener("input", syncHeight);
		});

		return () => {
			textareas.forEach((textarea) => {
				textarea.removeEventListener("input", syncHeight);
			});
		};
	}, []);

	useEffect(() => {
		setTimeout(() => {
			const element = document.querySelector('.inFocusQueue');
			if (element) element.focus();
		}, 200); // Slight delay ensures React has rendered it
	}, []);

	useEffect(() => {
		const inputs = document.querySelectorAll(".no-negative"); // Select all inputs with class
		inputs.forEach((input) => {
			input.addEventListener("input", (e) => {
				if (e.target.value < 0) e.target.value = 0; // Prevent negative numbers
			});
		});

		return () => {
			inputs.forEach((input) => {
				input.removeEventListener("input", () => { }); // Cleanup
			});
		};
	}, []);

	// Sync "Ship To" with "Bill To" when not manually modified
	useEffect(() => {
		if (OldID == "") { 
			if (!isShipToModified) {
				setShipPartyName(buyerPartyName);
			}
			prevBuyerPartyName.current = buyerPartyName;
		}
	}, [buyerPartyName]);

	useEffect(() => {
		if (OldID == "") {
			if (!isShipToModified) {
				setShipPartyAddr(buyerPartyAddr);
			}
			prevBuyerPartyAddr.current = buyerPartyAddr;
		}
	}, [buyerPartyAddr]);

	useEffect(() => {
		if (OldID == "") {
			if (!isShipToModified) {
				setShipToGSTState(billToGSTState);
			}
			prevBillToGSTState.current = billToGSTState;
		}
	}, [billToGSTState]);

	useEffect(() => {
		if (OldID == "") {
			if (!isShipToModified) {
				setShipToGSTIN(billToGSTIN);
			}
			prevBillToGSTIN.current = billToGSTIN;
		}
	}, [billToGSTIN]);

	// Handle manual modifications
	const handleShipToChange = (setter) => (e) => {
		checkForChagesInShipTo();
		setter(e.target.value);
	};

	const checkForChagesInShipTo = () => {
		if (buyerPartyName === shipPartyName && buyerPartyAddr === shipPartyAddr && billToGSTIN === shipToGSTIN && billToGSTState === shipToGSTState) {
			setIsShipToModified(true);
		} else {
			setIsShipToModified(false);
		}
	}

	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		let interval;
		if (loading) {
			setProgress(0);
			interval = setInterval(() => {
				setProgress((prev) => (prev < 90 ? prev + 2 : prev));
			}, 100);
		} else if (!loading && progress > 0) {
			setProgress(100);
			setTimeout(() => setProgress(0), 500);
		}
		return () => clearInterval(interval);
	}, [loading]);

	const deleteSale = async (id) => {
		try {
			await fetch(`${API_BASE_URL}/deletesale`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id })
			});
		} catch (error) {
			console.error("Error deleting sale:", error);
		}
	};

	const saveInvoice = async (isPrint = false) => {
		setLoading(true);
		try {
			//check if there is old id then delete it and then save with the existing id
			if (OldID && OldID != null) {
				await deleteSale(OldID);
			}
			console.log(OldID);
			await saveExistingCompany(OldID);
		} catch (err) {
			console.error("Error saving company:", err);
		} finally {
			setLoading(false);

			setTimeout(() => {
				if (isPrint) {
					window.print();
				}
				window.location.reload();
			}, 600);
		}
	};

	const saveInvoiceAndPrint = async () => {
		setLoading(true);
		try {
			await saveInvoice(true);
		} finally {
			setLoading(false);
		}
	};

	const saveExistingCompany = async (OldID) => {
		try {
			const bodyLayoutUID = await updateLayoutOnServer();

			// Now send the data
			const response = await axios.post(`${API_BASE_URL}/save-invoice`, {
				//Company Data

				//all below should be changed on the go and is database specific
				//cmpName: companyName.toLowerCase(),
				//cmpAddr: companyAddress,
				//cmpGSTIN: companyGSTIN,
				//TandC: terms,
				//Declaration: declaration,
				//BankName: bankName,
				//BankACNo: bankACNo,
				//BankIFSCNo: bankIfsc,
				//BankBranch: bankBranch,

				/////TabSalesMaster
				//TabItem and TabSalesDetail
				id: OldID,
				FullLayout: layout,
				CompanyAddr: companyAddress,
				AllItemDetails: items,
				//TabParty
				//billTo party data
				BillToPartyName: buyerPartyName,
				BillToPartyAddr: buyerPartyAddr.trim(),
				BillToPartyStateAndCode: billToGSTState,
				BillToPartyGSTIN: billToGSTIN,
				//shipTo party data
				ShipToPartyName: shipPartyName,
				ShipToPartyAddr: shipPartyAddr.trim(),
				ShipToPartyStateAndCode: shipToGSTState,
				ShipToPartyGSTIN: shipToGSTIN,
				//all other master details
				TranspDetail: transpDetail.trim(),
				MemoType: memoType,
				InvType: invoiceType,
				CopyType: copyType,
				InvNumber: invoiceNo,
				InvNoLayout: invoiceLayout,
				InvDate: invoiceDate,
				BodyLayoutNo: bodyLayoutUID,
				SalesType: salesType,
				Remark: remark,
				TotalVal: totalAmount,
				DiscountPer: discount,
				DiscountRs: discountRs,
				PackCharge: packaging,
				
				//all below are calculated automatically all the time but still needed for ex, amount of transactions and profit and loss etc.
				TaxableVal: totalWithDiscount.toFixed(2),
				//CGST: cgst,
				//SGST: sgst,
				//IGST: igst,
				TotalTax: (totalWithGST.toFixed(2) - totalWithDiscount.toFixed(2)).toFixed(2),
				GrandTotal: parseFloat(totalWithGST),
				//RoundOff: Math.sign(totalWithGST.toFixed(0) - totalWithGST) >= 0 ? `+${Math.abs(totalWithGST.toFixed(0) - totalWithGST).toFixed(2)}` : (totalWithGST.toFixed(0) - totalWithGST).toFixed(2),
			});

		} catch (error) {
			alert("Error updating company: " + (error.response?.data?.error || error.message));
		}
	};

	useEffect(() => {
		const getFirstTwoDigits = (str) => {
			if (!str || str.length < 2) return null;
			const code = str.substring(0, 2);
			return /^\d{2}$/.test(code) ? code : null;
		};

		const shipToGSTCode = getFirstTwoDigits(shipToGSTIN) || getFirstTwoDigits(shipToGSTState);
		const companyGSTCode = getFirstTwoDigits(companyGSTIN);

		// If both shipTo fields are empty, it's an export sale
		if (!shipToGSTIN && !shipToGSTState) {
			setSalesType("Export Sales");
			return;
		}

		// If either shipTo or company code is invalid, do nothing
		if (!shipToGSTCode || !companyGSTCode) return;

		// Compare both codes
		if (shipToGSTCode === companyGSTCode) {
			setSalesType("Local Sales");
		} else {
			setSalesType("Central Sales");
		}
	}, [shipToGSTIN, shipToGSTState, companyGSTIN]);

	const [companyDetailsGroup, setCompanyDetailsGroup] = useState([]);
	const companyAddressRef = useRef(null);
	const [companyOverlayPosition, setCompanyOverlayPosition] = useState({ top: 0, left: 0 });

	


	//fetch all data
	useEffect(() => {
		const fetchCompanyData = async () => {
			try {
				const response = await fetch(`${ API_BASE_URL }/getcompanydata`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({})
				});
				const data = await response.json();

				setCompanyName(data[0].CmpName);
				setBankName(data[0].BankName);
				setBankACNo(data[0].BankACNo);
				setBankIfsc(data[0].BankIFSCNo);
				setBankBranch(data[0].BankBranch);
				setTerms(data[0].TandC);
				setDeclaration(data[0].Declaration);
				setCompanyAddress(data[0].Details[0].Addr);
				setCompanyGSTIN(data[0].Details[0].GSTIN);

				// Store address-GSTIN pairs
				const detailGroup = data[0].Details.map(detail => ({
					Address: detail.Addr,
					GSTIN: detail.GSTIN
				}));
				setCompanyDetailsGroup(detailGroup);
			} catch (error) {
				console.error("Error fetching company data:", error);
			}
		};

		fetchCompanyData();
	}, []);

	const [companyAddressSuggestions, setCompanyAddressSuggestions] = useState([]);
	const [showCompanyOverlay, setShowCompanyOverlay] = useState(false);
	const [highlightedCompanyIndex, setHighlightedCompanyIndex] = useState(0);
	


	useLayoutEffect(() => {
		if (companyAddressRef.current) {
			const rect = companyAddressRef.current.getBoundingClientRect();
			setCompanyOverlayPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
		}
	}, [companyAddressRef, companyAddressSuggestions]); // Trigger on suggestion update or ref change

	const handleCompanyAddressInput = (e) => {
		const inputVal = e.target.value.toLowerCase();

		let filtered = companyDetailsGroup.filter(detail =>
			detail.Address.toLowerCase().includes(inputVal)
		);
		setCompanyAddressSuggestions(filtered);
		setCompanyAddress(e.target.value);
		setShowCompanyOverlay(true);
	};

	//load party data
	const [parties, setParties] = useState([]);
	const [partyDetailsGroup, setPartyDetailsGroup] = useState([]); // NEW state

	useEffect(() => {
		const fetchParties = async () => {
			try {
				const response = await fetch(`${API_BASE_URL}/getpartydata`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({})
				});
				const data = await response.json();

				// Store Party Names
				const partyNames = data.map(party => party.PartyName);
				setParties(partyNames);

				// Map all details, not just the first one
				const detailGroup = data.flatMap(party =>
					(party.Details || []).map(detail => ({
						PartyName: party.PartyName,
						Address: detail.Addr || '',
						GSTIN: detail.GSTIN || '',
						StateAndCode: detail.PartyStateAndCode || ''
					}))
				);

				setPartyDetailsGroup(detailGroup);

			} catch (error) {
				console.error("Error fetching parties:", error);
			}
		};

		fetchParties();
	}, []);

	useEffect(() => {
		if (!buyerPartyName) return; // Let it run even when OldID is not empty

		const match = partyDetailsGroup.find(
			party => party.PartyName === buyerPartyName
		);

		if (match && OldID === "") {
			setbuyerPartyAddr(match.Address);
			setBillToGSTIN(match.GSTIN);
			setBillToGSTState(match.StateAndCode);
		}
	}, [buyerPartyName, OldID]);

	useEffect(() => {
		if (!shipPartyName) return;

		const match = partyDetailsGroup.find(
			party => party.PartyName === shipPartyName
		);

		if (match && OldID === "") {
			setShipPartyAddr(match.Address);
			setShipToGSTIN(match.GSTIN);
			setShipToGSTState(match.StateAndCode);
		}
	}, [shipPartyName, OldID]);


	//suggestion system
	const [addressSuggestions, setAddressSuggestions] = useState([]);
	const [focusedAddressField, setFocusedAddressField] = useState(null);
	const [highlightedPartyIndex, setHighlightedPartyIndex] = useState(0);

	const AddressSuggestionOverlay = ({ suggestions, onSelect, position, width, highlightedIndex }) => {
		return (
			<div style={{
				position: 'absolute',
				top: position.top - 110,
				left: position.left - 34,
				width: width,
				maxHeight: '200px',
				zIndex: 2000,
				backgroundColor: 'white',
				border: '1px solid #ccc',
				boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
				fontSize: '14px'
			}}>
				{suggestions.map((item, idx) => (
					<div
						key={idx}
						style={{
							padding: '6px',
							cursor: 'pointer',
							backgroundColor: idx === highlightedIndex ? '#eee' : 'white'
						}}
						onMouseDown={() => onSelect(item)}
					>
						{item.Address.split('\n').map((line, i) => <div key={i}>{line}</div>)}
					</div>
				))}
			</div>
		);
	};

	const handleAddressInput = (e, forType) => {
		if (forType == "" || !forType) {
			setAddressSuggestions([]);
			setFocusedAddressField([]);
			return;
		}
		const inputVal = e.target.value.toLowerCase();
		const currentPartyName = forType === 'bill' ? buyerPartyName : shipPartyName;

		let filtered = partyDetailsGroup.filter(detail => {
			const addressMatch = detail.Address.toLowerCase().includes(inputVal);
			const partyMatch = !currentPartyName || detail.PartyName === currentPartyName;
			return addressMatch && partyMatch;
		});
		setAddressSuggestions(filtered);
		setFocusedAddressField(forType);
	};

	const handleKeyDown = (e, isCompany = false) => {
		const suggestions = isCompany ? companyAddressSuggestions : addressSuggestions;
		const setHighlightedIndex = isCompany ? setHighlightedCompanyIndex : setHighlightedPartyIndex;
		const highlightedIndex = isCompany ? highlightedCompanyIndex : highlightedPartyIndex;

		const showOverlay = isCompany ? showCompanyOverlay : addressSuggestions.length > 0;

		if (!showOverlay || suggestions.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
		}
		else if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
		}
		else if (e.key === "Enter") {
			e.preventDefault();
			applySelectedSuggestion(suggestions[highlightedIndex], isCompany);
		}
	};

	const applySelectedSuggestion = (selected, isCompany = false) => {
		if (!selected) return;
		if (isCompany) {
			// company overlay
			setCompanyAddress(selected.Address);
			setCompanyGSTIN(selected.GSTIN);
			setShowCompanyOverlay(false);
			setHighlightedCompanyIndex(0);
		} else {
			// bill / ship overlay
			if (focusedAddressField === "bill") {
				setbuyerPartyAddr(selected.Address);
				setBillToGSTIN(selected.GSTIN);
				setBillToGSTState(selected.StateAndCode);
				if (!buyerPartyName) setbuyerPartyName(selected.PartyName);
			} else {
				setShipPartyAddr(selected.Address);
				setShipToGSTIN(selected.GSTIN);
				setShipToGSTState(selected.StateAndCode);
				if (!shipPartyName) setShipPartyName(selected.PartyName);
			}
			setAddressSuggestions([]);
			setHighlightedPartyIndex(0);
		}
	};



	const billRef = useRef(null);
	const shipRef = useRef(null);
	const [overlayPosition, setOverlayPosition] = useState({ top: 0, left: 0, width: '0px' });

	useLayoutEffect(() => {
		if (!focusedAddressField) return;
		const elem = focusedAddressField === 'bill' ? billRef.current : shipRef.current;
		if (elem) {
			const rect = elem.getBoundingClientRect();
			setOverlayPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: `${rect.width}px` });
		}
	}, [focusedAddressField, addressSuggestions]);

	useEffect(() => {
		const handleClickOutside = (e) => {
			const clickedOutsideAll =
				!billRef.current?.contains(e.target) &&
				!shipRef.current?.contains(e.target) &&
				!companyAddressRef.current?.contains(e.target);

			if (clickedOutsideAll) {
				setFocusedAddressField(null);
				setAddressSuggestions([]);
				setShowCompanyOverlay(false); // if you're using a separate flag for company overlay
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);


 
  return (
    <div className="create-bill-container">

      {/* A4 Paper Container */}
	  <table style={{marginLeft:'15px', marginTop:'5px'}}>
      <div className="invoice-a4">
        {/* ------------- TOP SECTION ------------- */}
        <div className="invoice-top">
			<tr>
          <div className="invoice-row">
		  <td style={{width: '248.5mm', height: '40px', backgroundColor: '#c7c7c7'}}>
            {/* Company Name (center after focus) */}
			<div className="cell cell-company-name">
				<input readOnly
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={
                  companyName === "" ? "Company Name" : ""
                }
                onBlur={(e) => {
                  // Could set text-align center or handle differently
                }}
              />
              {/*<button className="save-button">Save</button>*/}
            </div>
			</td>
          </div>
			</tr>
			
          <div className="invoice-row">
            {/* Company Address (textarea) */}
            <div className="cell cell-company-address">
				<textarea
					className="inFocusQueue autoExpand"
					ref={companyAddressRef}
					value={companyAddress}
					rows="2"
					onChange={(e) => {
						setCompanyAddress(e.target.value);
						handleCompanyAddressInput(e);
					}}
					onFocus={(e) => handleCompanyAddressInput(e)}
					onKeyDown={(e) => handleKeyDown(e, true)}  // Pass `true` for company
					placeholder={
						companyAddress === "" ? "Address Line 1" + '\n' + "Address Line 2" : ""
					}
				/>
              {/*<button className="save-button">Save</button>*/}
            </div>
          </div>

					  {/*three selects*/ }
			<div className="invoice-row">
			  <table className="invoice-table">
				<tbody>
				  <tr>
					<td className="left-align">
					  <select value={memoType} onChange={(e) => setMemoType(e.target.value)} className="cell-selects inFocusQueue">
						<option>Debit Memo</option>
						<option>Cash Memo</option>
					  </select>
					</td>
					<td className="center-align">
					  <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} className="cell-selects inFocusQueue">
						<option>Tax Invoice</option>
						<option>Bill Of Supply</option>
					  </select>
					</td>
					<td className="right-align">
					  <select value={copyType} onChange={(e) => setCopyType(e.target.value)} className="cell-selects inFocusQueue">
						<option>Original</option>
						<option>Duplicate</option>
						<option>Triplicate</option>
					  </select>
					</td>
				  </tr>
				</tbody>
			  </table>
			</div>
			
			<tr>
				<td style={{width: '250mm', height:'auto', border:'none'}}>
					<th style={{width: '125mm'}}>Bill To</th>
					<th style={{width: '125mm'}}>Ship To</th>
				</td>
			</tr>
			<datalist id="party-list">
				{parties.map((party, index) => (
					<option key={index} value={party} />
				))}
			</datalist>

					  {addressSuggestions.length > 0 && (
						  <AddressSuggestionOverlay
							  suggestions={addressSuggestions}
							  onSelect={applySelectedSuggestion}
							  position={overlayPosition}
							  width={overlayPosition.width}
							  highlightedIndex={highlightedPartyIndex}  // Pass the highlighted index for party address
						  />
					  )}

					  {showCompanyOverlay && companyAddressSuggestions.length > 0 && (
						  <AddressSuggestionOverlay
							  suggestions={companyAddressSuggestions}
							  onSelect={applySelectedSuggestion}
							  position={companyOverlayPosition}
							  width="100%"
							  highlightedIndex={highlightedCompanyIndex}  // Pass the highlighted index for company address
						  />
					  )}

          <div style={{borderBottom: '1px solid black', marginTop:'-2px'}} className="invoice-row">
			{/* Bill To / Ship To */}
			<div className="cell cell-bill-ship">
				<div style={{ display: "flex", alignItems: "flex-start", padding: '6px', borderRight: '1px solid black', fontSize: '14px' }}>
					<span style={{ marginTop: '1px' }}>Party:</span>
					<div style={{ marginLeft: "5px", marginTop: '0.5px' }}>
						<input list="party-list" type='text' value={buyerPartyName} onChange={(e) => setbuyerPartyName(e.target.value)} className='inFocusQueue' style={{ minWidth: '108.8mm', maxWidth: '108.8mm' }} placeholder='Party Name' onFocus={(e) => handleAddressInput(e, '')} />
						<textarea
							ref={billRef}
							className='inFocusQueue autoExpand expandTogether address-suggestions'
							style={{ minWidth: '108.8mm', maxWidth: '108.8mm' }}
							value={buyerPartyAddr}
							onChange={(e) => {
								setbuyerPartyAddr(e.target.value);
								handleAddressInput(e, 'bill');
							}}
							onFocus={(e) => {
								setFocusedAddressField("bill"); // ✅ Set focused field
								handleAddressInput(e, 'bill');
							}}
							onKeyDown={(e) => handleKeyDown(e, false)}
							placeholder={buyerPartyAddr === "" ? "Party Address" : ""}
						/>
					</div>
				</div>
				<div style={{ display: "flex", alignItems: "flex-start", padding: '6px', borderRight: '1px solid black' }}>
								  <span style={{ marginTop: '1px', fontSize: '14px', width: '28mm' }}>State And Code:</span>
					{/*<input className="gstState" style={{width:'71mm', fontSize:'14px'}} type='text' />*/}
								  <GSTStateInput widthOfInput='91.8mm' className='inFocusQueue' value={billToGSTState} onChange={setBillToGSTState} onFocus={(e) => handleAddressInput(e, '')} />
				</div>
				<div style={{ display: "flex", alignItems: "flex-start", padding: '6px', borderRight: '1px solid black' }}>
					<span style={{ marginTop: '1px', fontSize: '14px', width: '28mm' }}>GSTIN No.:</span>
								  <input value={billToGSTIN} onChange={(e) => setBillToGSTIN(e.target.value)} className='inFocusQueue' style={{ width: '91.8mm', fontSize: '14px' }} type='text' onFocus={(e) => handleAddressInput(e, '')} />
				</div>
				{/*<button className="save-button">Save</button>*/}
			</div>
			<div className="cell cell-bill-ship">
				<div style={{ display: "flex", alignItems: "flex-start", padding: '6px', fontSize: '14px' }}>
					<span style={{ marginTop: '1px' }}>Party:</span>
					<div style={{ marginLeft: "5px", marginTop: '0.5px' }}>
						<input list="party-list" type='text' value={shipPartyName} onChange={handleShipToChange(setShipPartyName)} className='inFocusQueue' style={{ minWidth: '107.8mm', maxWidth: '107.8mm' }} placeholder='Party Name' onFocus={(e) => handleAddressInput(e, '')} />
						<textarea
							ref={shipRef}
							className='inFocusQueue autoExpand expandTogether address-suggestions'
							style={{ minWidth: '107.8mm', maxWidth: '107.8mm' }}
							value={shipPartyAddr}
							onChange={(e) => {
								setShipPartyAddr(e.target.value);
								handleAddressInput(e, 'ship');
							}}
							onFocus={(e) => {
								setFocusedAddressField("ship"); // ✅ Set focused field
								handleAddressInput(e, 'ship');
							}}
							onKeyDown={(e) => handleKeyDown(e, false)}
							placeholder={shipPartyAddr === "" ? "Party Address" : ""}
						/>
					</div>
				</div>
				<div style={{ display: "flex", alignItems: "flex-start", padding: '6px' }}>
					<span style={{ marginTop: '1px', fontSize: '14px', width: '28mm' }}>Place of Supply:</span>
					{/*<input className="gstState" style={{width:'71mm', fontSize:'14px'}} type='text' />*/}
								  <GSTStateInput widthOfInput='90.8mm' className='inFocusQueue' value={shipToGSTState} onChange={setShipToGSTState} style={{ width: '71mm' }} onFocus={(e) => handleAddressInput(e, '')} />
				</div>
				<div style={{ display: "flex", alignItems: "flex-start", padding: '6px' }}>
					<span style={{ marginTop: '1px', fontSize: '14px', width: '28mm' }}>GSTIN No.:</span>
								  <input value={shipToGSTIN} onChange={handleShipToChange(setShipToGSTIN)} className='inFocusQueue' style={{ width: '90.8mm', fontSize: '14px' }} type='text' onFocus={(e) => handleAddressInput(e, '')} />
				</div>
				{/*<button className="save-button">Save</button>*/}
			</div>
		</div>

          <div style={{borderBottom: '1px solid black'}} className="invoice-row">
            {/* Delivery Addr / Invoice No / Date */}
			
			<div style={{ display: "flex", alignItems: "flex-start", borderRight: '1px solid black'}}>
			<div className="cell" style={{ display: "flex", alignItems: "flex-start", padding: '6px', marginRight: '0px'}}>
				{/*<button className="save-button">Save</button>*/}
				  <span style={{marginTop: '1px', fontSize:'14px'}}>Transporter<br/>Details:</span>
				  <textarea className='inFocusQueue autoExpand'
					style={{marginLeft: "5px", fontSize: '14px', minWidth: '99.5mm', maxWidth: '99.5mm'}}
					value={transpDetail}
					onChange={(e) => setTranspDetail(e.target.value)}
					placeholder={transpDetail === "" ? "" : ""}
				  />
				  
				</div>
				</div>
				<div style={{padding:'6px'}} >
				<div style={{ width: "86mm", marginBottom: '6px' }} className="cell">
					<label>Invoice No:</label>
					<input
						className='inFocusQueue'
						style={{ width: '50mm' }}
						type="text"
						value={fullInvoiceNo}
						onChange={handleInvoiceChange}
						placeholder={fullInvoiceNo === "" ? "Invoice No" : ""}
					/>
					{error && <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>}
				</div>
            <div className="cell">
              <label>Date:</label>
              <input className='inFocusQueue'
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
              {/*<button className="save-button noTop">Save</button>*/}
            </div>
			</div>
          </div>
        </div>


					  <InvoiceBody
					  items={items}
					  setItems={setItems}
					  addNewRow={addNewRow}
					  removeRow={removeRow}
					  updateAllGST={updateAllGST}
					  handleItemChange={handleItemChange}
					  layout={layout}
					  setLayout={setLayout}
					  />

        {/* ------------- BOTTOM SECTION ------------- */}
        <div className="invoice-bottom">
          {/* Row 1: Total */}
		  <div style={{borderBottom: '1px solid black', borderTop: '1px solid black', fontSize: '14px'}} className="invoice-row">
			  <div style={{padding:'6px'}} >
				<div style={{width: "76mm", marginBottom:'6px'}} className="cell left-align">
					<label>Sales:</label>
					<input
						type="text"
						style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
						className="inFocusQueue"
						onFocus={() => {
							try {
								const lastIndex = items.length - 1;
								const lastProduct = items[lastIndex]?.productName?.trim();

								if (lastProduct === "") {
									removeRow(lastIndex);

									// Focus the actual select immediately
									setTimeout(() => {
										try {
											document.getElementById("sales-type")?.focus();
										} catch { }
									}, 0);
								} else {
									addNewRow();
								}
							} catch (err) {
								// Silent fail — do nothing
							}
						}}
						tabIndex={-1} // makes it programmatically focusable
					/>

					<select
						style={{ fontSize: '14px' }}
						value={salesType}
						onChange={(e) => setSalesType(e.target.value)}
						className="cell-selects inFocusQueue"
						id='sales-type'
					>
						<option>Local Sales</option>
						<option>Central Sales</option>
						<option>Export Sales</option>
					</select>


				  {/*<button className="save-button noTop">Save</button>*/}
				</div>
				</div>
			<div className="col" style={{fontSize: '14px',padding: '6px'}}>
				<label>GSTIN:</label>
				<input type='text' className='inFocusQueue' value={companyGSTIN} onChange={(e) => setCompanyGSTIN(e.target.value)} />
			</div>
          <div className="bottom-row" style={{fontSize: '14px', marginLeft: "auto", marginRight:'1.5mm'}}>
            <div className="col">Total:</div>
            <div className="col">{total.toFixed(2)}</div>
          </div>
		  </div>

          {/* Row 2: Invoice value in words + discount, packaging, insurance */}
          <div className="bottom-row" style={{fontSize:"14px", borderBottom: '1px solid black'}}>
            <div className="col" style={{ display: "flex", alignItems: "flex-start", padding: '6px', borderRight: '1px solid black', marginTop:"-5px", marginBottom:"-5px", maxWidth:"138.3mm", minWidth:"138.3mm"}}>
              <div>Invoice Value (In Words):</div>
              <div>{numberToWords(totalWithGST.toFixed(0))}</div>
            </div>
            <div>
			  <div style={{ 
				display: "flex", 
				alignItems: "center", 
				padding: "6px", 
				marginTop: "-5px", 
				gap: "4.8px", 
				width: "108mm" 
			  }}>
				<label style={{ display: "flex", alignItems: "center", gap: "3px" }}>
				  Discount (
				  <input 
					className='inFocusQueue no-negative'
					type="number"
					id="discount"
					value={discount}
					style={{ width: "15mm", marginTop: "3px" }}
					onInput={updateDiscountRs} // Update Rs when percentage changes
				  />
				  %)
				</label>

				<span style={{ marginLeft: "auto", marginRight: "5mm", fontWeight:'bold' }}>-</span>
				<input 
				  style={{ width: "52mm", textAlign: "right" }}  
				  className="right-align inFocusQueue no-negative"
				  type="number"
				  id="discountRs"
				  value={discountRs}
				  placeholder="0"
				  onInput={updateGSTAndRemoveDiscountPercentageField} // Update percentage when Rs changes
				/>
			  </div>

			  <div style={{ 
				display: "flex", 
				alignItems: "center", 
				padding: "6px", 
				marginTop: "-5px", 
				gap: "5.5px", 
				width: "108mm" 
			  }}>
				<label>Packaging Charge</label>
				<span style={{ marginLeft: "auto", marginRight: "4.5mm", fontWeight:'bold' }}>+</span>
				<input 
				  style={{ width: "52mm", textAlign: "right" }}  
				  className="right-align inFocusQueue no-negative" 
				  type="number"
				  value={packaging}
				  onInput={(e) => {
					let value = parseFloat(e.target.value);
					if (!isNaN(value)) {
					  value = parseFloat(value.toFixed(2)); // Ensure only 2 decimal places
					} else {
					  value = 0; // Fallback for invalid input
					}
					setPackaging(value);
				  }}
				  placeholder="0"
				/>
			  </div>
			</div>

          </div>

          {/* Row 3: Remark + Bank details + CGST/SGST/IGST */}
          <div className="bottom-row" style={{borderBottom: '1px solid black', fontSize: '14px', marginTop:'-5px'}}>
            <div className="col" style={{padding: '6px 6px 0px 6px', borderRight: '1px solid black', marginBottom:'-5px', maxWidth:"138.3mm", minWidth:"138.3mm"}}>
              <label>Remark: </label>
              <input className='inFocusQueue'
				style={{width:'120mm'}}
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>
			<div className="col" style={{display:'flex',alignItems: "flex-start",padding: '6px'}}>
              <label>Taxable Value:</label>
              <div style={{marginLeft:'auto',marginRight:'1mm'}}>{totalWithDiscount.toFixed(2)}</div>
            </div>
		  </div>
		  <div className="bottom-row" style={{padding: '6px', fontSize:'14px', borderBottom: '1px solid black'}}>
			  <div style={{ display: 'flex', borderRight: '1px solid black', marginTop: '-6px', marginBottom: '-6px', width: "140mm", justifyContent: 'flex-start' }}>
  
			  {/* First Column */}
			  <div className="col" style={{ marginTop: '6px', flex: "0 0 80mm" }}>
				<label className="bold"><u>Company's Bank Details:</u></label><br />
    
				<div style={{ display: "flex", alignItems: "center", gap: "3px", marginLeft: "8px" }}>
					<label>Bank Name: </label>
					<input style={{ width: '50mm' }} readOnly
					type="text"
					value={bankName}
					onChange={(e) => setBankName(e.target.value)}
					placeholder="Bank Name"
				  />
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "3px", marginLeft: "8px", marginTop: "4px" }}>
				  <label>A/c No.: </label>
				  <input style={{ width: '57.3mm'}} readOnly
					type="text"
					value={bankACNo}
					onChange={(e) => setBankACNo(e.target.value)}
					placeholder="Account Number"
				  />
				</div>
			  </div>

			  {/* Second Column */}
			  <div className="col" style={{ marginTop: '21px',flex: "0 0 70mm", marginLeft:'-6mm' }}>
	
				<div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
				  <label>Branch:</label>
				  <input style={{ width: '43.5mm'}} readOnly
					type="text"
					value={bankBranch}
					onChange={(e) => setBankBranch(e.target.value)}
					placeholder="Bank Branch"
				  />
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "4px" }}>
				  <label>IFSC No.:</label>
				  <input style={{ width: '40mm' }} readOnly
					type="text"
					value={bankIfsc}
					onChange={(e) => setBankIfsc(e.target.value)}
					placeholder="IFSC Number"
				  />
				</div>
    
			  </div>

			</div>


            <div className="col" style={{borderRight:'1px solid black', marginTop:'-6px', marginBottom:'-6px', padding:'6px'}}>
              <div>
                <label>CGST:</label>
                <input style={{width:'22mm'}}
                  type="number"
                  value={salesType==='Local Sales'?(((totalWithGST.toFixed(2) - totalWithDiscount.toFixed(2)).toFixed(2))/2).toFixed(2):''}
                  onChange={(e) => setCgst(e.target.value)}
				  readOnly
                />
              </div>
              <div>
                <label>SGST:</label>
                <input style={{width:'22mm'}}
                  type="number"
                  value={salesType==='Local Sales'?(((totalWithGST.toFixed(2) - totalWithDiscount.toFixed(2)).toFixed(2))/2).toFixed(2):''}
                  onChange={(e) => setSgst(e.target.value)}
                  readOnly
                />
              </div>
              <div>
                <label>IGST:</label>
                <input style={{width:'22mm'}}
                  type="number"
                  value={salesType==='Central Sales'?((totalWithGST.toFixed(2) - totalWithDiscount.toFixed(2)).toFixed(2)):''}
                  onChange={(e) => setIgst(e.target.value)}
                  readOnly
                />
              </div>
            </div>
			<div className="col" >
				<div style={{ textAlign: "right", marginRight:'-0.5px' }}>{(totalWithGST.toFixed(2) - totalWithDiscount.toFixed(2)).toFixed(2)}</div>
			</div>
          </div>

          {/* Row 4: Terms + Round off + Invoice Value in figure */}
          <div className="bottom-row" style={{borderBottom: '1px solid black'}}>
            <div className="col">
				<div style={{ padding: '6px', borderRight: '1px solid black', marginTop:'-6px', marginBottom:'-6px'}}>
				  <span className="bold" style={{marginTop: '1px', fontSize:'14px'}}><u>Terms & Conditions:</u></span><br />
				  <textarea style={{fontSize:'12px',minWidth:'135.5mm',maxWidth:'135.5mm',height:'28px'}}
					className="autoExpand"
					rows="3"
					value={terms}
					onChange={(e) => setTerms(e.target.value)}
					readOnly
				  />
				  {/*<button className="save-button noTop">Save</button>*/}
				</div>
            </div>
            <div className="col" style={{fontSize:'14px', marginLeft: '-3px'}}>
			<div style={{display:'flex',alignItems: "flex-start",paddingTop:'6px'}}>
				<div style={{ width:'104mm',
				  position: "relative", 
				  display: "inline-block", 
				  paddingBottom: "10px" // Adjust for spacing
				}}>
					<div style={{display:'flex',alignItems: "flex-start"}}>
						<label>Round Off: </label>
										  <div style={{ marginLeft: 'auto', marginRight: '2.5px' }}>
											  {Math.sign(totalWithGST.toFixed(0) - totalWithGST) >= 0
												  ? `+${Math.abs(totalWithGST.toFixed(0) - totalWithGST).toFixed(2)}`
												  : (totalWithGST.toFixed(0) - totalWithGST).toFixed(2)}
										  </div>
					</div>
					  <div style={{
						position: "absolute",
						bottom: 0,
						left: "-7px",
						right: "-7px",
						height: "1px",
						backgroundColor: "black"
					  }}></div>
				</div>
				</div>
				<div style={{display:'flex',alignItems: "flex-start",paddingTop:'6px'}}>
					<label>Grand Total: </label>
					<div style={{marginLeft:'auto', marginRight:'4.5px'}}>{totalWithGST.toFixed(0)}</div>{/*Invoice Value (In Figure):*/}
				</div>
            </div>
          </div>

          {/* Row 5: Declaration + For + Signature */}
          <div className="bottom-row" style={{borderBottom: '1px solid black'}}>
            <div className="col">
				<div style={{ padding: '6px', borderRight: '1px solid black', marginTop:'-6px', marginBottom:'-6px'}}>
              <span className="bold" style={{marginTop: '1px', fontSize:'14px'}}><u>Declaration:</u></span>
              <textarea style={{fontSize:'12px',minWidth:'135.5mm',maxWidth:'135.5mm',height:'39px'}}
				className="autoExpand"
				rows="3"
				readOnly
                value={declaration}
                onChange={(e) => setDeclaration(e.target.value)}
              />
              {/*<button className="save-button noTop">Save</button>*/}
			  </div>
            </div>
            <div className="col col2" style={{textAlign:'center'}}>
				<div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize:'15px'}}>
					{/*<label >For:</label>*/}
				<input readOnly
				  style={{ marginTop: '2px', width: '55mm', textAlign: 'center' }}
				  className="bold"
				  type="text"
				  value={`For ${companyName}`} // ✅ Correct way
				/>
			  </div>
              <div className="signature-area">
                Authorized Signature
              </div>
            </div>
          </div>
        </div>
      </div>
	  </table>
		  <div>
			  {/* loading Progress Overlay */}
			  {progress > 0 && (
				  <div className="progress-overlay dontPrint">
					  <span className="rotating-settings">⚙️</span>
					  <div className="progress-bar">
						  <div
							  className="progress-fill"
							  style={{ width: `${progress}%` }}
						  ></div>
					  </div>
				  </div>
			  )}

			  {/* Styles */}
			  <style jsx>{`
                .progress-overlay {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.9);
                    padding: 10px;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
                    font-size: 24px;
                    z-index: 1000;
                    width: 150px;
                }

                .rotating-settings {
                    display: inline-block;
                    animation: rotate 1s linear infinite;
                }

                @keyframes rotate {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                .progress-bar {
                    width: 100%;
                    height: 6px;
                    background: #e0e0e0;
                    border-radius: 3px;
                    overflow: hidden;
                    margin-top: 8px;
                }

                .progress-fill {
                    height: 100%;
                    background: #4caf50;
                    transition: width 0.2s ease-in-out;
                }

				.cancel {
                    background: #ff4d4d;
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 5px;
                    cursor: pointer;
					margin-left: 15px;
                }
            `}</style>

			  <button className="cancel dontPrint" onClick={() => navigate("/")}>Cancel</button>

			  <button
				  className="btn inFocusQueue dontPrint"
				  style={{ margin: '4mm 0mm 0mm 177mm' }}
				  onClick={saveInvoiceAndPrint}
				  onKeyDown={(e) => {
					  if (e.key === 'Enter') {
						  e.preventDefault(); // Prevent default button behavior
						  saveInvoiceAndPrint();
					  }
				  }}
				  tabIndex={0}
			  >
				  Save & Print
			  </button>

			  <button
				  className="btn dontPrint"
				  style={{ margin: '4mm 0mm 0mm 4mm' }}
				  onClick={() => saveInvoice(false)} // ✅ Click handler
				  onKeyDown={(e) => {
					  if (e.key === 'Enter') {
						  e.preventDefault(); // Prevent default button behavior
						  saveInvoice(false);
					  }
				  }}
			  >
				  Save
			  </button>
	  </div>
	  <br/>
	  <br/>
	  <br/>
	  <br/>
	  <br/>
	  <br/>
	  <br/>
	  <br/>
	  <br/>
	  <br/>
    </div>
	
	
  );
}

export default Layout1;
