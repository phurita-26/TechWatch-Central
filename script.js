/* ==========================================================================
   TechWatch Central — script.js
   ใช้ร่วมกันทุกหน้า: product.html / order.html / admin.html
   สคริปต์จะเช็คว่าหน้าปัจจุบันมี element ของหน้าไหน แล้วรันเฉพาะส่วนที่เกี่ยวข้อง
   ========================================================================== */

const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzIKa0ZiySHDTqvEJgqDC-F9UN7qhrbsKQtThvruGl5a8pRIJGoKDJjuLFFHOI-C321/exec";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTwB-mMSCNwucTFwHnlNSrAghKuXXSsLkHK92zU0pHwKOygE1-AZiZ0BEx1x9Z0GEPv6V1UDgvDhi-9/pub?gid=0&single=true&output=csv";

const BRAND_LABELS = {
  all: "ทั้งหมด",
  xiaomi: "Xiaomi",
  samsung: "Samsung",
  apple: "Apple",
  huawei: "HUAWEI",
};

/* ==========================================================================
   Helpers
   ========================================================================== */

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatPrice(price) {
  const number = Number(price) || 0;
  return number.toLocaleString("th-TH") + " บาท";
}

/* ==========================================================================
   1) product.html — แสดงสินค้าเป็นการ์ด + ตัวกรองแบรนด์
   ========================================================================== */

function initProductPage() {
  const filterBar = document.getElementById("filter-bar");
  const productList = document.getElementById("product-list");
  if (!productList) return;

  let allProducts = [];
  let activeBrand = getParam("brand") || "all";

  function renderFilterBar() {
    if (!filterBar) return;
    filterBar.innerHTML = "";

    Object.keys(BRAND_LABELS).forEach((brandKey) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.textContent = BRAND_LABELS[brandKey];
      btn.dataset.brand = brandKey;
      if (brandKey === activeBrand) {
        btn.classList.add("filter-btn--active");
      }
      btn.addEventListener("click", () => {
        activeBrand = brandKey;
        renderFilterBar();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function buildOrderLink(product) {
    const params = new URLSearchParams();
    params.set("item", product.name);
    params.set("price", product.price);
    return `order.html?${params.toString()}`;
  }

  function renderProducts() {
    const filtered =
      activeBrand === "all"
        ? allProducts
        : allProducts.filter((p) => p.brand === activeBrand);

    productList.innerHTML = "";

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "product-empty";
      empty.textContent = "ไม่พบสินค้าในหมวดนี้";
      productList.appendChild(empty);
      return;
    }

    filtered.forEach((product) => {
      const card = document.createElement("article");
      card.className = `product-card product-card--${product.brand}`;

      card.innerHTML = `
        <img class="product-card__image" src="${product.image}" alt="${product.name}" loading="lazy">
        <div class="product-card__body">
          <span class="brand-badge brand-badge--${product.brand}">${BRAND_LABELS[product.brand] || product.brand}</span>
          <h3 class="product-card__name">${product.name}</h3>
          <p class="product-card__desc">${product.description}</p>
          <div class="product-card__footer">
            <span class="product-card__price">${formatPrice(product.price)}</span>
            <a class="btn btn--primary" href="${buildOrderLink(product)}">สั่งซื้อ</a>
          </div>
        </div>
      `;

      productList.appendChild(card);
    });
  }

  fetch("products.json")
    .then((res) => res.json())
    .then((data) => {
      allProducts = data;
      renderFilterBar();
      renderProducts();
    })
    .catch((error) => {
      console.error(error);
      productList.innerHTML =
        '<p class="product-empty">โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>';
    });
}

/* ==========================================================================
   2) order.html — ฟอร์มสั่งซื้อ
   ========================================================================== */

function initOrderPage() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  const itemsField = document.getElementById("items");
  const totalField = document.getElementById("total");
  const customerNameField = document.getElementById("customerName");
  const contactField = document.getElementById("contact");
  const noteField = document.getElementById("note");

  // เติมข้อมูลจาก URL parameter ทันทีที่โหลดหน้า
  const itemParam = getParam("item");
  const priceParam = getParam("price");

  if (itemParam && itemsField) {
    itemsField.value = itemParam;
  }
  if (priceParam && totalField) {
    totalField.value = priceParam;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const payload = {
      customerName: customerNameField ? customerNameField.value : "",
      contact: contactField ? contactField.value : "",
      items: itemsField ? itemsField.value : "",
      total: totalField ? totalField.value : "",
      note: noteField ? noteField.value : "",
    };

    fetch(
      "https://script.google.com/macros/s/AKfycbzIKa0ZiySHDTqvEJgqDC-F9UN7qhrbsKQtThvruGl5a8pRIJGoKDJjuLFFHOI-C321/exec",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    )
      .then(() => {
        window.location.href = "thankyou.html";
      })
      .catch((error) => {
        console.error(error);
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      });
  });
}

/* ==========================================================================
   3) admin.html — ตารางคำสั่งซื้อจาก Google Sheet (CSV)
   ========================================================================== */

// parse CSV แบบไม่พึ่ง library ภายนอก รองรับฟิลด์ที่ครอบด้วย " และมี , หรือ \n อยู่ข้างใน
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\r") {
        // ข้าม \r เฉยๆ รอ \n ปิดแถว
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
  }

  // แถวสุดท้ายที่ไม่มี \n ปิดท้าย
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function initAdminPage() {
  const tableBody = document.querySelector("#ordersTable tbody");
  if (!tableBody) return;

  fetch(SHEET_CSV_URL)
    .then((res) => res.text())
    .then((csvText) => {
      const rows = parseCSV(csvText);
      if (rows.length === 0) return;

      // แถวแรกเป็น header ถ้ามี ให้ตัดออก (เช็คว่าคอลัมน์แรกไม่ใช่วันที่)
      let dataRows = rows;
      const firstCellIsDate = !isNaN(Date.parse(rows[0][0]));
      if (!firstCellIsDate) {
        dataRows = rows.slice(1);
      }

      // เรียงจากล่าสุดขึ้นก่อน โดยอิงคอลัมน์ A (วันเวลา)
      dataRows.sort((a, b) => {
        const dateA = new Date(a[0]);
        const dateB = new Date(b[0]);
        return dateB - dateA;
      });

      tableBody.innerHTML = "";

      dataRows.forEach((cols) => {
        const [dateTime, customerName, contact, items, total, note] = cols;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${dateTime || ""}</td>
          <td>${customerName || ""}</td>
          <td>${contact || ""}</td>
          <td>${items || ""}</td>
          <td>${total || ""}</td>
          <td>${note || ""}</td>
        `;
        tableBody.appendChild(tr);
      });
    })
    .catch((error) => {
      console.error(error);
      tableBody.innerHTML =
        '<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</td></tr>';
    });
}

/* ==========================================================================
   Init
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
