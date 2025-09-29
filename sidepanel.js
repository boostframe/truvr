document.addEventListener('DOMContentLoaded', function () {
  // Fetch data from the server
  fetch('http://ec2-18-194-45-243.eu-central-1.compute.amazonaws.com:8000/')
      .then(response => response.json())
      .then(data => {
          document.getElementById('data').innerText = data.message;
      })
      .catch(error => {
          console.error('Error fetching data:', error);
          document.getElementById('data').innerText = 'Failed to fetch data';
      });
      
    });
    
    getThemeLocal().then(theme => {
      console.log(theme.theme);
      document.documentElement.setAttribute('data-theme', theme.theme);
    });
  
//chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
//document.getElementById("getHtml").addEventListener("click", async () => {
async function getHtmlContent(message) {  
  console.log(message.url);
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => document.documentElement.outerHTML,
    });

    if (result && result.result) {
      const html = result.result;

      // Parse the string into a DOM object
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove all <style>, <script>, <link>, <select>, <meta>, and <iframe> tags
      const tagsToRemove = ['style', 'script', 'link', 'select', 'meta', 'iframe'];
      tagsToRemove.forEach(tag => {
        const elements = doc.querySelectorAll(tag);
        elements.forEach(el => el.remove());
      });

      // Serialize the DOM back to a string
      let cleanedHTML = new XMLSerializer().serializeToString(doc);
      cleanedHTML = cleanedHTML.replace(/^\s*$(?:\r\n?|\n)/gm, ''); // Remove empty lines

      // Extract price using XPath
      const xpathResult = doc.evaluate('//span[contains(@class, "aok-offscreen") or contains(@class, "a-offscreen")]/text()', doc, null, XPathResult.STRING_TYPE, null);
      const price = xpathResult.stringValue;
      console.log("price:", price);

      // Send the cleaned HTML to the backend
      const response = await fetch('http://ec2-18-194-45-243.eu-central-1.compute.amazonaws.com:8000/upload-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html: cleanedHTML, link: message.url}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { task_id } = await response.json();
      console.log("Task started with ID:", task_id);
      // progressbad toggle
      //clearHtml();
      //toggleAllCards();
      //toggleMain();
      let resulz = await getStateLocal('flowstate');
      console.log(resulz);
      if (resulz.flowstate === '1') {
        showMainLoading();
        clearTables();
        clearProductCard();
        clearCarousel();
      } else if (resulz.flowstate === '2') {
      toggleAllCards();
      toggleMain();
      showMainLoading();
      clearTables();
      clearProductCard();
      clearCarousel();
      }
      //showProgressBar();
      // Poll the status of the task every few seconds
      const intervalId = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://ec2-18-194-45-243.eu-central-1.compute.amazonaws.com:8000/task-status/${task_id}`);
          
          if (!statusResponse.ok) {
            document.getElementById('task-data').innerText = 'Failed to receive data from backend server';
            throw new Error(`HTTP error! status: ${statusResponse.status}`);
          }

          const statusResult = await statusResponse.json();

          if (statusResult.status === 'completed') {
            clearInterval(intervalId);
            document.getElementById('task-data').innerText = 'Task Complete';
            console.log('Task completed with result:', statusResult.result);
            //showProgressBar();
            //showAdditional();
            setStateLocal("2");
            showMainLoading();
            toggleMain();
            toggleAllCards();
            updateJsonAndModifyHtml(statusResult);
            populateTables(statusResult);
            populateProductCard(statusResult);
            createCarousel(statusResult);
          } else {
            document.getElementById('task-data').innerText = 'Processing...';
            console.log('Task is still processing...');
            
          }
        } catch (error) {
          document.getElementById('task-data').innerText = "Error checking task status";
          console.error("Error checking task status:", error);
        }
      }, 2000);
    }
  } catch (error) {
    console.error("Error during execution:", error);
    document.getElementById('task-data').innerText = "Error during execution";
  }
}

setStateLocal("1");


function setStateLocal(value){
  console.log('init');
  const data = {};
  let key = 'flowstate';
  data[key] = value;
  chrome.storage.local.set(data);
}

function setThemeLocal(value){
  console.log('init');
  const data = {};
  let key = 'theme';
  data[key] = value;
  chrome.storage.local.set(data);
}

function getThemeLocal(){
  let result = '';
  let key = 'theme'
  result = chrome.storage.local.get([key]);
  return result || 'light' ;
}

function getStateLocal(){
  let result = '';
  let key = 'flowstate'
  result = chrome.storage.local.get([key]);
  return result;
}

function clearProductCard() {
  const tableDiv = document.getElementById('productbox');
  tableDiv.innerHTML = '';
}

function changeThemeFunction() {
      console.log('darkSwitch');

      // Array of themes to cycle through
      const themes = [
       "dark", "synthwave",
       "valentine", "halloween", "forest", "aqua",
      "pastel", "wireframe", "black", "luxury", "dracula",
      "business", "acid", "lemonade", "night", "coffee", "dim",
      "nord", "sunset"
    ];
    
 
    // Keep track of the current theme index
    let currentThemeIndex = 0;
    
    // Get the button element
    const toggleThemeButton = document.getElementById('darkModeButton');
    
    // Function to toggle the theme
 
   // Increment the theme index, looping back to the start if necessary
   //currentThemeIndex = (currentThemeIndex + 1) % themes.length;
   const randomThemeIndex = Math.floor(Math.random() * themes.length);
   // Set the new theme on the <html> element
   document.documentElement.setAttribute('data-theme', themes[randomThemeIndex]);
   setThemeLocal(themes[randomThemeIndex]);
   console.log(themes[randomThemeIndex]);
}

document.getElementById('switchThemeButton').addEventListener('click', changeThemeFunction);


function populateProductCard(statusResult) {
  // function to update the main product card
  const prdData = statusResult.result.processed_data;
  const llmData = statusResult.result.llm_data.specs;
  const tagData = statusResult.result.tag_data;

  // Create an object that maps the keys to the corresponding values
  const productInfo = {
    "Product Name": prdData.product_name,
    "Product Price": prdData.price,
    "Product Description": llmData.Excerpt1,
    //"Other Description": prdData.short_description,
    "Product Tags": tagData.Tags, // assuming tags is an array
    "Other Info": prdData.other_info,
    //"Product Photos": prdData.photo, // you can handle this separately for images
    "Product Link": "https://amazon.com/dp/" + prdData.SKU, // assuming SKU is the link
    "Product SKU": prdData.SKU,
    "Product Rating": prdData.rating
  };

  // Assume `specsDiv` is the div where you want to append the elements
  const prdDiv = document.getElementById('productbox'); // Replace 'specsDiv' with your actual div ID

  // Loop through the productInfo object and append to the div
  for (const [key, value] of Object.entries(productInfo)) {
    // Create and append the label (e.g., 'Product Name:')
    const label = document.createElement('p');
    label.className = 'font-semibold text-sm text-gray-800 dark:text-neutral-900';
    label.textContent = `${key}:`;
    prdDiv.appendChild(label);

    // Create and append the horizontal rule
    const hr = document.createElement('hr');
    prdDiv.appendChild(hr);

    // Create and append the value (e.g., 'ASUS ROG Falchion NX...')
    const valueP = document.createElement('p');
    valueP.textContent = value ? value : 'Not Available';
    valueP.id = key.replace(/\s+/g, '_').toLowerCase();
    prdDiv.appendChild(valueP);

    // Add line break for spacing
    const br = document.createElement('br');
    prdDiv.appendChild(br);
  }

}

function populateTables(statusResult) {
  const llmData = statusResult.result.llm_data;
  // Assume llmData is already defined and contains pros and cons arrays
  const pros = llmData.specs.Excerpt2.Pros;
  const cons = llmData.specs.Excerpt2.Cons;

  // Get the table body element where rows will be inserted
  const tableBody = document.getElementById('pros-cons-table');

  // Determine the maximum number of rows (based on the longer array)
  const maxRows = Math.max(pros.length, cons.length);

  // Clear the table body before adding rows
  tableBody.innerHTML = '';

  // Loop through and populate rows for both pros and cons
  for (let i = 0; i < maxRows; i++) {
    // Create a new table row
    const row = document.createElement('tr');
    
    // Create the index cell
    const indexCell = document.createElement('th');
    indexCell.textContent = i + 1;

    // Create the pros cell
    const prosCell = document.createElement('td');
    prosCell.textContent = pros[i] || ''; // Add pros or leave empty if no value

    // Create the cons cell
    const consCell = document.createElement('td');
    consCell.textContent = cons[i] || ''; // Add cons or leave empty if no value

    // Append cells to the row
    row.appendChild(indexCell);
    row.appendChild(prosCell);
    row.appendChild(consCell);

    // Append the row to the table body
    tableBody.appendChild(row);
  }

}

function clearCarousel() {
  const carouselContainer = document.getElementById('carousel-container');

  // Clear any existing slides
  carouselContainer.innerHTML = '';
}

function clearTables() {
  const tableDiv = document.getElementById('pros-cons-table');
  tableDiv.innerHTML = '';
  const tableDiv2 = document.getElementById('specs-tbody');
  tableDiv2.innerHTML = '';
}

//document.getElementById('button5').addEventListener('click', function () {
function clearHtml() {
  const specsDiv = document.getElementById('specs');
  specsDiv.innerHTML = '';
}

function updateJsonAndModifyHtml(statusResult) {
  const llmData = statusResult.result.llm_data;
  //console.log(llmData);
  //console.log(llmData.specs?.Specifications);
  //console.log(llmData.specs.Specification);
  // Accessing Excerpt1
  const excerpt1 = llmData.specs.Excerpt1;

  // Accessing Excerpt2's pros and cons
  const pros = llmData.specs.Excerpt2.Pros;
  const cons = llmData.specs.Excerpt2.Cons;
  // llmData.specs?.Specification or llmData.specs.Specification

  const productSpecs = llmData.specs.Specifications

// Get the div element where specs will be inserted
const specsDiv = document.getElementById('specs');
const productDiv = document.getElementById('productbox');


// Loop through the specs and create <p> tags for each
//for (const [key, value] of Object.entries(productSpecs)) {
//    const p = document.createElement('p');
//    p.textContent = `${key}: ${value}`;
//    specsDiv.appendChild(p);
//}
// Select the specific <tbody> by ID
const tbody = document.getElementById('specs-tbody');

// Keep track of row numbers (S.NO)
let rowNumber = 1;

// Loop through the specs and create table rows for each
for (const [key, value] of Object.entries(productSpecs)) {
    const tr = document.createElement('tr');
    
    // Create the S.NO column
    const th = document.createElement('th');
    th.textContent = rowNumber;
    tr.appendChild(th);
    
    // Create the Specification column
    const tdSpec = document.createElement('td');
    tdSpec.textContent = key;
    tr.appendChild(tdSpec);
    
    // Create the Value column
    const tdValue = document.createElement('td');
    tdValue.textContent = value;
    tr.appendChild(tdValue);
    
    // Append the row to the table body
    tbody.appendChild(tr);
    
    // Increment the row number for S.NO
    rowNumber++;
}


}

document.getElementById("button4").addEventListener("click", () => {
  async function startTask() {
    try {
      console.log("Async request sent");

      const response = await fetch('http://ec2-18-194-45-243.eu-central-1.compute.amazonaws.com:8000/start-task/', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: 'Sample Data' }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { task_id } = await response.json();

      // Poll the status of the task every few seconds
      const intervalId = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://ec2-18-194-45-243.eu-central-1.compute.amazonaws.com:8000/task-status/${task_id}`);
          
          if (!statusResponse.ok) {
            document.getElementById('task-data').innerText = 'Failed to recieve data from backend-server';
            throw new Error(`HTTP error! status: ${statusResponse.status}`);
          }
          
          const statusResult = await statusResponse.json();

          if (statusResult.status === 'completed') {
            clearInterval(intervalId);
            document.getElementById('task-data').innerText = 'Task Complete:' + statusResult.result;
            console.log('Task completed with result:', statusResult.result);
            showProgressBar();
          } else {
            document.getElementById('task-data').innerText = 'processing...';
            console.log('Task is still processing...');
            showProgressBar();
          }
        } catch (error) {
          document.getElementById('task-data').innerText ="Error checking task status";
          console.error("Error checking task status:", error);
        }
      }, 2000);

    } catch (error) {
      document.getElementById('task-data').innerText ="Error starting task";
      console.error("Error starting task:", error);
    }
  }

  startTask();
});


function createCarousel(statusResult) {
  const prdData = statusResult.result.processed_data;
  images = prdData.photo
  const carouselContainer = document.getElementById('carousel-container');

  // Clear any existing slides
  carouselContainer.innerHTML = '';

  images.forEach((image, index) => {
    // Determine the previous and next slide indices
    const prevSlide = index === 0 ? images.length : index;
    const nextSlide = (index + 2) > images.length ? 1 : index + 2;

    // Create a new div for each slide
    const slideDiv = document.createElement('div');
    slideDiv.id = `slide${index + 1}`;
    slideDiv.className = 'carousel-item relative w-full';

    // Add the image element
    const imgElement = document.createElement('img');
    imgElement.src = image;
    imgElement.className = 'w-full';

    // Create the navigation buttons (previous and next)
    const navDiv = document.createElement('div');
    navDiv.className = 'absolute left-2 right-2 top-1/2 flex -translate-y-1/2 transform justify-between';

    const prevLink = document.createElement('a');
    prevLink.href = `#slide${prevSlide}`;
    prevLink.className = 'btn btn-circle';
    prevLink.textContent = '❮';

    const nextLink = document.createElement('a');
    nextLink.href = `#slide${nextSlide}`;
    nextLink.className = 'btn btn-circle';
    nextLink.textContent = '❯';

    // Append navigation links to the nav div
    navDiv.appendChild(prevLink);
    navDiv.appendChild(nextLink);

    // Append image and navigation to the slide div
    slideDiv.appendChild(imgElement);
    slideDiv.appendChild(navDiv);

    // Append the slide to the carousel container
    carouselContainer.appendChild(slideDiv);
  });
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
      e.preventDefault();

      document.querySelector(this.getAttribute('href')).scrollIntoView({
          behavior: 'smooth'
      });
  });
});

function showProgressBar() {
const progressBar = document.getElementById('progressBar');
  progressBar.hidden = !progressBar.hidden;
const progressBar2 = document.getElementById('progressBar2');
  progressBar2.hidden = !progressBar2.hidden;
  const progressBar3 = document.getElementById('progressBar3');
  progressBar3.hidden = !progressBar3.hidden;
}

function showAdditional() {
  const progressButton = document.getElementById('toggleButton');
  progressButton.hidden = !progressButton.hidden;
  const progressButton2 = document.getElementById('toggleButton2');
  progressButton2.hidden = !progressButton2.hidden;
  const tableSpecs = document.getElementById('table-specs');
  tableSpecs.hidden = !tableSpecs.hidden;
  const tablePros = document.getElementById('table-pc');
  tablePros.hidden = !tablePros.hidden;

}

function toggleAllCards() {
  for (let i = 1; i <= 3; i++) {
    const card = document.getElementById(`main-card-0${i}`);
    if (card) {
      card.hidden = !card.hidden; // Hide the card
    }
  }
}

function toggleMain() {
  const loadingAnimation = document.getElementById('main-loading-card');
  loadingAnimation.hidden = !loadingAnimation.hidden;
}

function showMainLoading() {
  const loadingAnimation = document.getElementById('circle-loader');
  loadingAnimation.hidden = !loadingAnimation.hidden;
  const loadingAnimation2 = document.getElementById('circle-static');
  loadingAnimation2.hidden = !loadingAnimation2.hidden;
  const carouselContainer = document.getElementById('main-status');
  carouselContainer.innerHTML = 'Processing...';
}

//function showMore() {
  const article = document.getElementById('productbox');
  const toggleButton = document.getElementById('toggleButton');

  toggleButton.addEventListener('click', () => {
    article.classList.toggle('expanded');

    // Change button text based on the state
    if (article.classList.contains('expanded')) {
      toggleButton.textContent = 'Show Less';
    } else {
      toggleButton.textContent = 'Show More';
    }
  });

  const article2 = document.getElementById('specs');
  const toggleButton2 = document.getElementById('toggleButton2');

  toggleButton2.addEventListener('click', () => {
    article2.classList.toggle('expanded');

    // Change button text based on the state
    if (article2.classList.contains('expanded')) {
      toggleButton2.textContent = 'Show Less';
    } else {
      toggleButton2.textContent = 'Show More';
    }
  });
//}
// Add a click event listener to the button
//document.getElementById('openPageButton').addEventListener('click', function() {
  // Open another HTML page in the side panel
  //window.location.href = 'sp2.html';
//});

// Listener to receive messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  //console.log("Received message:", message);
  if (message.type === 'URL_NOW') {
      console.log("Received message:", message);
      getHtmlContent(message);
      //return true;
      // Process the message as needed
  }
});


document.getElementById('download-icon').addEventListener('click', function () {
  // Function to download CSV file from table data
  const table = document.getElementById("table-pc");
  let csvContent = "";
  
  for (let row of table.rows) {
    const rowData = [];
    for (let cell of row.cells) {
      rowData.push(cell.innerText.replace(/,/g, "")); // Escape commas
    }
    csvContent += rowData.join(",") + "\n";
  }
  
  // Create a hidden anchor element and download the CSV
  const downloadLink = document.createElement("a");
  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = "pros_cons.csv";
  
  // Append anchor to body and trigger click event for download
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
});


document.getElementById('download-icon2').addEventListener('click', function () {
  // Function to download CSV file from table data
  const table = document.getElementById("table-specs");
  let csvContent = "";
  
  for (let row of table.rows) {
    const rowData = [];
    for (let cell of row.cells) {
      rowData.push(cell.innerText.replace(/,/g, "")); // Escape commas
    }
    csvContent += rowData.join(",") + "\n";
  }
  
  // Create a hidden anchor element and download the CSV
  const downloadLink = document.createElement("a");
  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = "specsheet.csv";
  
  // Append anchor to body and trigger click event for download
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
});




document.getElementById('download-icon3').addEventListener('click', function () {
  // Function to download CSV file from product data
  const productBox = document.getElementById('productbox');
  const rows = productBox.querySelectorAll('p.font-semibold, p:not(.font-semibold)');

  // Check if there are enough rows to extract title and description
  if (rows.length < 2) {
    console.error('Not enough product data available.');
    return;
  }

  // Initialize CSV with headers
  let csvContent = 'Title,Description,Price,Tags,Other Info,Link,Product SKU,Product Rating,Image Links\n';
  
  // Extract title and description
  const title = document.getElementById('product_name')?.innerText.replace(/,/g, '')|| 'N/A'; // Replace commas with spaces
  const description = document.getElementById('product_description')?.innerText.replace(/,/g, '') || 'N/A'; // Replace commas with spaces

  // Get additional info: tags, other info, link, SKU, rating
  const price = document.getElementById('product_price')?.innerText.replace(/,/g, ' ') || 'N/A'; // Use tags as-is
  const tags = document.getElementById('product_tags')?.innerText.replace(/,/g, ';') || 'N/A'; // Use tags as-is
  const otherInfo = document.getElementById('other_info')?.innerText.replace(/,/g, ' ') || 'N/A'; // Replace commas with spaces
  const link = document.getElementById('product_link')?.innerText || 'N/A'; // Product link
  const sku = document.getElementById('product_sku')?.innerText.replace(/,/g, ' ') || 'N/A'; // Replace commas with spaces
  const rating = document.getElementById('product_rating')?.innerText.replace(/,/g, ' ') || 'N/A'; // Replace commas with spaces

  // Extract image links from the carousel
  const imageLinks = [];
  const carouselImages = document.querySelectorAll('#carousel-container img');
  carouselImages.forEach(img => {
    imageLinks.push(img.src);
  });

  // Combine all data into a single row
  csvContent += `${title},${description},${price},${tags},${otherInfo},${link},${sku},${rating},${imageLinks.join(' : ')}\n`;

  // Create a hidden anchor element and download the CSV
  const downloadLink = document.createElement('a');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = 'product_data.csv';

  // Append anchor to body and trigger click event for download
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
});


