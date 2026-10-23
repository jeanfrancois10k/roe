const fs = require('fs');

// 1. SellTicketScreen.kt
const sellPath = 'C:/Users/herod/OneDrive/Desktop/ROE/android-vendor/app/src/main/java/com/roebolet/vendor/ui/sell/SellTicketScreen.kt';
let sellContent = fs.readFileSync(sellPath, 'utf8');

// Replace ticketDate
const oldTicketDatePattern = /val ticketDate = ticket\.createdAt\?\.take\(19\)\?\.replace\("T", " "\)[\s\S]*?\?: java\.text\.SimpleDateFormat\("yyyy-MM-dd HH:mm:ss", java\.util\.Locale\.US\)\.format\(java\.util\.Date\(\)\)/;
if (oldTicketDatePattern.test(sellContent)) {
  sellContent = sellContent.replace(oldTicketDatePattern, 'val ticketDate = TicketReceiptUtil.formatHaitiDateTimeSeconds(ticket.createdAt)');
  console.log('Replaced ticketDate in SellTicketScreen');
} else {
  console.log('Warning: oldTicketDate pattern not found in SellTicketScreen');
}

// Replace nowFormatted
const oldNow = 'val nowFormatted = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date())';
const newNow = 'val nowFormatted = TicketReceiptUtil.currentHaitiDateTimeString()';
if (sellContent.includes(oldNow)) {
  sellContent = sellContent.replace(oldNow, newNow);
  console.log('Replaced nowFormatted in SellTicketScreen');
} else {
  console.log('Warning: nowFormatted not found in SellTicketScreen');
}

// Replace xxxx HTG
sellContent = sellContent.replace(/text = "xxxx HTG",[\s\r\n]*color = Color\(0xFF757575\)/g, 'text = "GRATUIT",\n                                                color = Color(0xFF2E7D32),\n                                                fontWeight = FontWeight.Bold');

fs.writeFileSync(sellPath, sellContent, 'utf8');
console.log('SellTicketScreen.kt updated successfully');

// 2. ThermalPrinterService.kt
const thermalPath = 'C:/Users/herod/OneDrive/Desktop/ROE/android-vendor/app/src/main/java/com/roebolet/vendor/util/ThermalPrinterService.kt';
let thermalContent = fs.readFileSync(thermalPath, 'utf8');
thermalContent = thermalContent.replace('val dateDisplay = TicketReceiptUtil.formatHaitiDateTime(ticket.createdAt)', 'val dateDisplay = TicketReceiptUtil.formatHaitiDateTimeSeconds(ticket.createdAt)');
thermalContent = thermalContent.replace('val right = "xxxx HTG"', 'val right = "GRATUIT"');
fs.writeFileSync(thermalPath, thermalContent, 'utf8');
console.log('ThermalPrinterService.kt updated successfully');

// 3. TicketsListScreen.kt
const listPath = 'C:/Users/herod/OneDrive/Desktop/ROE/android-vendor/app/src/main/java/com/roebolet/vendor/ui/tickets/TicketsListScreen.kt';
let listContent = fs.readFileSync(listPath, 'utf8');
listContent = listContent.replace(/text = "xxxx HTG",[\s\r\n]*color = Color\(0xFF757575\)/g, 'text = "GRATUIT",\n                                    color = Color(0xFF2E7D32),\n                                    fontWeight = FontWeight.Bold');
listContent = listContent.replace('text = TicketReceiptUtil.formatHaitiDateTime(previewTicket.createdAt)', 'text = TicketReceiptUtil.formatHaitiDateTimeSeconds(previewTicket.createdAt)');
listContent = listContent.replace('formatHaitiDateTime(reprintTicket.createdAt)', 'formatHaitiDateTimeSeconds(reprintTicket.createdAt)');
fs.writeFileSync(listPath, listContent, 'utf8');
console.log('TicketsListScreen.kt updated successfully');
