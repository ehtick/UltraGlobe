import { addMinutes } from "date-fns";
import { toZonedTime, fromZonedTime, getTimezoneOffset } from "date-fns-tz";

var timezones = [
  'UTC',
  'Europe/Andorra',
  'Asia/Dubai',
  'Asia/Kabul',
  'Europe/Tirane',
  'Asia/Yerevan',
  'Antarctica/Casey',
  'Antarctica/Davis',
  'Antarctica/DumontDUrville', // https://bugs.chromium.org/p/chromium/issues/detail?id=928068
  'Antarctica/Mawson',
  'Antarctica/Palmer',
  'Antarctica/Rothera',
  'Antarctica/Syowa',
  'Antarctica/Troll',
  'Antarctica/Vostok',
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba',
  'America/Argentina/Salta',
  'America/Argentina/Jujuy',
  'America/Argentina/Tucuman',
  'America/Argentina/Catamarca',
  'America/Argentina/La_Rioja',
  'America/Argentina/San_Juan',
  'America/Argentina/Mendoza',
  'America/Argentina/San_Luis',
  'America/Argentina/Rio_Gallegos',
  'America/Argentina/Ushuaia',
  'Pacific/Pago_Pago',
  'Europe/Vienna',
  'Australia/Lord_Howe',
  'Antarctica/Macquarie',
  'Australia/Hobart',
  'Australia/Currie',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Australia/Broken_Hill',
  'Australia/Brisbane',
  'Australia/Lindeman',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Perth',
  'Australia/Eucla',
  'Asia/Baku',
  'America/Barbados',
  'Asia/Dhaka',
  'Europe/Brussels',
  'Europe/Sofia',
  'Atlantic/Bermuda',
  'Asia/Brunei',
  'America/La_Paz',
  'America/Noronha',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Araguaina',
  'America/Maceio',
  'America/Bahia',
  'America/Sao_Paulo',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Santarem',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Manaus',
  'America/Eirunepe',
  'America/Rio_Branco',
  'America/Nassau',
  'Asia/Thimphu',
  'Europe/Minsk',
  'America/Belize',
  'America/St_Johns',
  'America/Halifax',
  'America/Glace_Bay',
  'America/Moncton',
  'America/Goose_Bay',
  'America/Blanc-Sablon',
  'America/Toronto',
  'America/Nipigon',
  'America/Thunder_Bay',
  'America/Iqaluit',
  'America/Pangnirtung',
  'America/Atikokan',
  'America/Winnipeg',
  'America/Rainy_River',
  'America/Resolute',
  'America/Rankin_Inlet',
  'America/Regina',
  'America/Swift_Current',
  'America/Edmonton',
  'America/Cambridge_Bay',
  'America/Yellowknife',
  'America/Inuvik',
  'America/Creston',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Vancouver',
  'America/Whitehorse',
  'America/Dawson',
  'Indian/Cocos',
  'Europe/Zurich',
  'Africa/Abidjan',
  'Pacific/Rarotonga',
  'America/Santiago',
  'America/Punta_Arenas',
  'Pacific/Easter',
  'Asia/Shanghai',
  'Asia/Urumqi',
  'America/Bogota',
  'America/Costa_Rica',
  'America/Havana',
  'Atlantic/Cape_Verde',
  'America/Curacao',
  'Indian/Christmas',
  'Asia/Nicosia',
  'Asia/Famagusta',
  'Europe/Prague',
  'Europe/Berlin',
  'Europe/Copenhagen',
  'America/Santo_Domingo',
  'Africa/Algiers',
  'America/Guayaquil',
  'Pacific/Galapagos',
  'Europe/Tallinn',
  'Africa/Cairo',
  'Africa/El_Aaiun',
  'Europe/Madrid',
  'Africa/Ceuta',
  'Atlantic/Canary',
  'Europe/Helsinki',
  'Pacific/Fiji',
  'Atlantic/Stanley',
  'Pacific/Chuuk',
  'Pacific/Pohnpei',
  'Pacific/Kosrae',
  'Atlantic/Faroe',
  'Europe/Paris',
  'Europe/London',
  'Asia/Tbilisi',
  'America/Cayenne',
  'Africa/Accra',
  'Europe/Gibraltar',
  'America/Godthab',
  'America/Danmarkshavn',
  'America/Scoresbysund',
  'America/Thule',
  'Europe/Athens',
  'Atlantic/South_Georgia',
  'America/Guatemala',
  'Pacific/Guam',
  'Africa/Bissau',
  'America/Guyana',
  'Asia/Hong_Kong',
  'America/Tegucigalpa',
  'America/Port-au-Prince',
  'Europe/Budapest',
  'Asia/Jakarta',
  'Asia/Pontianak',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Europe/Dublin',
  'Asia/Jerusalem',
  'Asia/Kolkata',
  'Indian/Chagos',
  'Asia/Baghdad',
  'Asia/Tehran',
  'Atlantic/Reykjavik',
  'Europe/Rome',
  'America/Jamaica',
  'Asia/Amman',
  'Asia/Tokyo',
  'Africa/Nairobi',
  'Asia/Bishkek',
  'Pacific/Tarawa',
  'Pacific/Enderbury',
  'Pacific/Kiritimati',
  'Asia/Pyongyang',
  'Asia/Seoul',
  'Asia/Almaty',
  'Asia/Qyzylorda',
  'Asia/Qostanay', // https://bugs.chromium.org/p/chromium/issues/detail?id=928068
  'Asia/Aqtobe',
  'Asia/Aqtau',
  'Asia/Atyrau',
  'Asia/Oral',
  'Asia/Beirut',
  'Asia/Colombo',
  'Africa/Monrovia',
  'Europe/Vilnius',
  'Europe/Luxembourg',
  'Europe/Riga',
  'Africa/Tripoli',
  'Africa/Casablanca',
  'Europe/Monaco',
  'Europe/Chisinau',
  'Pacific/Majuro',
  'Pacific/Kwajalein',
  'Asia/Yangon',
  'Asia/Ulaanbaatar',
  'Asia/Hovd',
  'Asia/Choibalsan',
  'Asia/Macau',
  'America/Martinique',
  'Europe/Malta',
  'Indian/Mauritius',
  'Indian/Maldives',
  'America/Mexico_City',
  'America/Cancun',
  'America/Merida',
  'America/Monterrey',
  'America/Matamoros',
  'America/Mazatlan',
  'America/Chihuahua',
  'America/Ojinaga',
  'America/Hermosillo',
  'America/Tijuana',
  'America/Bahia_Banderas',
  'Asia/Kuala_Lumpur',
  'Asia/Kuching',
  'Africa/Maputo',
  'Africa/Windhoek',
  'Pacific/Noumea',
  'Pacific/Norfolk',
  'Africa/Lagos',
  'America/Managua',
  'Europe/Amsterdam',
  'Europe/Oslo',
  'Asia/Kathmandu',
  'Pacific/Nauru',
  'Pacific/Niue',
  'Pacific/Auckland',
  'Pacific/Chatham',
  'America/Panama',
  'America/Lima',
  'Pacific/Tahiti',
  'Pacific/Marquesas',
  'Pacific/Gambier',
  'Pacific/Port_Moresby',
  'Pacific/Bougainville',
  'Asia/Manila',
  'Asia/Karachi',
  'Europe/Warsaw',
  'America/Miquelon',
  'Pacific/Pitcairn',
  'America/Puerto_Rico',
  'Asia/Gaza',
  'Asia/Hebron',
  'Europe/Lisbon',
  'Atlantic/Madeira',
  'Atlantic/Azores',
  'Pacific/Palau',
  'America/Asuncion',
  'Asia/Qatar',
  'Indian/Reunion',
  'Europe/Bucharest',
  'Europe/Belgrade',
  'Europe/Kaliningrad',
  'Europe/Moscow',
  'Europe/Simferopol',
  'Europe/Kirov',
  'Europe/Astrakhan',
  'Europe/Volgograd',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Novosibirsk',
  'Asia/Barnaul',
  'Asia/Tomsk',
  'Asia/Novokuznetsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Chita',
  'Asia/Yakutsk',
  'Asia/Khandyga',
  'Asia/Vladivostok',
  'Asia/Ust-Nera',
  'Asia/Magadan',
  'Asia/Sakhalin',
  'Asia/Srednekolymsk',
  'Asia/Kamchatka',
  'Asia/Anadyr',
  'Asia/Riyadh',
  'Pacific/Guadalcanal',
  'Indian/Mahe',
  'Africa/Khartoum',
  'Europe/Stockholm',
  'Asia/Singapore',
  'America/Paramaribo',
  'Africa/Juba',
  'Africa/Sao_Tome',
  'America/El_Salvador',
  'Asia/Damascus',
  'America/Grand_Turk',
  'Africa/Ndjamena',
  'Indian/Kerguelen',
  'Asia/Bangkok',
  'Asia/Dushanbe',
  'Pacific/Fakaofo',
  'Asia/Dili',
  'Asia/Ashgabat',
  'Africa/Tunis',
  'Pacific/Tongatapu',
  'Europe/Istanbul',
  'America/Port_of_Spain',
  'Pacific/Funafuti',
  'Asia/Taipei',
  'Europe/Kiev',
  'Europe/Uzhgorod',
  'Europe/Zaporozhye',
  'Pacific/Wake',
  'America/New_York',
  'America/Detroit',
  'America/Kentucky/Louisville',
  'America/Kentucky/Monticello',
  'America/Indiana/Indianapolis',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Indiana/Marengo',
  'America/Indiana/Petersburg',
  'America/Indiana/Vevay',
  'America/Chicago',
  'America/Indiana/Tell_City',
  'America/Indiana/Knox',
  'America/Menominee',
  'America/North_Dakota/Center',
  'America/North_Dakota/New_Salem',
  'America/North_Dakota/Beulah',
  'America/Denver',
  'America/Boise',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Juneau',
  'America/Sitka',
  'America/Metlakatla',
  'America/Yakutat',
  'America/Nome',
  'America/Adak',
  'Pacific/Honolulu',
  'America/Montevideo',
  'Asia/Samarkand',
  'Asia/Tashkent',
  'America/Caracas',
  'Asia/Ho_Chi_Minh',
  'Pacific/Efate',
  'Pacific/Wallis',
  'Pacific/Apia',
  'Africa/Johannesburg'
];

function ultraClock(properties) {
  var listeners = [];
  var date = new Date();
  var selectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  
  function drawClock() {}

  if (properties) {
    let offsetDifference = 0;
    const canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    canvas.width = 200;
    canvas.height = 200;
    canvas.style = 'position: absolute; bottom: 120px; left: 2%;';
    var ctx = canvas.getContext("2d");
    var radius = canvas.height / 2;

    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    radius = radius * 0.90;
    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.id = 'hiddenCanvas';
    hiddenCanvas.style = 'position: absolute; bottom: 120px; left: 2%; filter: blur(5px); pointer-events: none;';

    hiddenCanvas.width = canvas.width;
    hiddenCanvas.height = canvas.height;
    var hiddenCtx = hiddenCanvas.getContext('2d');
    hiddenCtx.translate(radius, radius);

    ctx.translate(radius, radius);

    var touchX;

    document.body.appendChild(hiddenCanvas);
    document.body.appendChild(canvas);
    drawClock();

    // Mouse Events
    canvas.addEventListener('mousedown', function (event) {
      touchX = event.clientX - event.clientY;
    });

    document.addEventListener('mousemove', function (event) {
      if (typeof touchX === "undefined") return;
      var x = 2 * ((event.clientX - event.clientY) - touchX);
      touchX = event.clientX - event.clientY;
      date = addMinutes(date, x);
      drawClock();
    });

    document.addEventListener('mouseup', function () {
      touchX = undefined;
    });

    // Touch Events
    canvas.addEventListener('touchstart', function (event) {
      touchX = event.touches[0].clientX - event.touches[0].clientY;
    });

    document.addEventListener('touchmove', function (event) {
      if (typeof touchX === "undefined") return;
      var touch = event.touches[0];
      var x = 4 * ((touch.clientX - touch.clientY) - touchX);
      touchX = touch.clientX - touch.clientY;
      date = addMinutes(date, x);
      drawClock();
    });

    document.addEventListener('touchend', function (event) {
      if (event.touches.length == 0) {
        touchX = undefined;
      }
    });

    // Draw Clock Function
    drawClock = () => {
      drawTime(hiddenCtx, radius);
      drawTime(ctx, radius);
      listeners.forEach(listener => listener(date));
    }

    // Draw Time Function
    function drawTime(ctx, radius) {
      const zonedDate = toZonedTime(date, selectedTimezone);

      ctx.clearRect(-radius, -radius, radius * 2, radius * 2);

      const hours = zonedDate.getHours();
      const minutes = zonedDate.getMinutes();
      var fraction = (minutes + (hours * 60)) / 1440;
      ctx.beginPath();
      const start = -0.5 * Math.PI;
      const end = start + (fraction * 2 * Math.PI);
      ctx.arc(0, 0, radius * 0.9, start, end);
      ctx.strokeStyle = "turquoise";
      ctx.lineCap = "round";
      ctx.lineWidth = radius * 0.1;
      ctx.stroke();

      var x = radius * 0.9 * Math.cos(end);
      var y = radius * 0.9 * Math.sin(end);

      // Draw a white circle at the end of the arc
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.1, 0, 2 * Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();

      ctx.font = radius * 0.25 + "px Arial";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      var timeStr = 
        (hours < 10 ? "0" : "") + hours + ":" + 
        (minutes < 10 ? "0" : "") + minutes;
      ctx.fillText(timeStr, 0, radius * -0.1);

      var day = zonedDate.getDate();
      var monthIndex = zonedDate.getMonth();
      var year = zonedDate.getFullYear();
      var dateStr = day + ' ' + monthNames[monthIndex] + ' ' + year;
      ctx.font = radius * 0.15 + "px Arial";
      ctx.fillText(dateStr, 0, radius * 0.2);
    }

    // Datetime Picker Integration
    if (properties.dateTimePicker) {
      const datetimePickerElement = document.createElement('input');
      datetimePickerElement.id = 'datetime-picker';
      datetimePickerElement.type = 'text';
      datetimePickerElement.style = 'position: absolute; bottom: 120px; left: 2%; display: none;';
      document.body.appendChild(datetimePickerElement);

      const flatpickrCSS = document.createElement('link');
      flatpickrCSS.rel = 'stylesheet';
      flatpickrCSS.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
      document.head.appendChild(flatpickrCSS);

      // Dynamically load the Flatpickr JavaScript
      const flatpickrScript = document.createElement('script');
      flatpickrScript.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
      flatpickrScript.onload = () => {
        var datetimePicker = flatpickr('#datetime-picker', {
          enableTime: true,
          dateFormat: "Y-m-d H:i",
        });

        let mouseDownX = 0;
        let mouseDownY = 0;

        // Event listener for mouse down
        canvas.addEventListener('mousedown', function (event) {
          mouseDownX = event.clientX;
          mouseDownY = event.clientY;
        });
        canvas.addEventListener('mouseup', function (event) {
          const distanceMoved = Math.sqrt(
            Math.pow(event.clientX - mouseDownX, 2) + 
            Math.pow(event.clientY - mouseDownY, 2)
          );

          const threshold = 5;

          if (distanceMoved < threshold) {
            datetimePicker.open();
          }
        });

        // Update the date and redraw the clock when a date is selected
        datetimePicker.config.onChange.push(function (selectedDates, dateStr, instance) {
          if (selectedDates.length > 0) {
            date = selectedDates[0];
            date = fromZonedTime(date, selectedTimezone);
            drawClock();
          }
        });
      };
      document.head.appendChild(flatpickrScript);
    }

    // Timezone Selection Integration
    if (properties.timezone) {
      const blurredSelect = document.createElement('select');
      blurredSelect.style.cssText = `
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        padding-left: 20px;
        width: 180px;
        height: 40px;
        position: absolute;
        top: 60px;
        left: 10px;
        border: 4px solid #66CDAA;
        border-radius: 18px;
        filter: blur(4px);
        z-index: 1;
        pointer-events: none;
      `;

      // Create the second select element for actual user interaction
      const timezoneSelect = document.createElement('select');
      timezoneSelect.id = 'timezoneSelect';
      timezoneSelect.style.cssText = `
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        padding-left: 20px;
        width: 180px;
        height: 40px;
        position: absolute;
        top: 60px;
        left: 10px;
        border: 4px solid #66CDAA;
        background-color: transparent;
        border-radius: 18px;
        z-index: 2;
      `;

      document.body.appendChild(blurredSelect);
      document.body.appendChild(timezoneSelect);

      window.addEventListener('DOMContentLoaded', (event) => {
        
        const guessedTimezone = selectedTimezone; // Use detected timezone

        timezones.forEach(timezone => {
          const option = document.createElement('option');
          option.value = timezone;
          option.text = timezone;
          if (timezone === guessedTimezone) {
            option.selected = true;
            selectedTimezone = timezone;
          }
          timezoneSelect.appendChild(option);
        });

        timezoneSelect.addEventListener('change', function () {
          const selected = this.value;
          selectedTimezone = selected;
          const now = new Date();

          // Calculate the offset difference in minutes
          offsetDifference = (getTimezoneOffset(selectedTimezone, now) / (1000 * 60)) - now.getTimezoneOffset();

          drawClock();
        });
      });
    }

  }

  function addListener(func) {
    listeners.push(func);
    if (typeof drawClock === "function") drawClock();
  }

  function setDate(aDate) {
    date = aDate;
    if (typeof drawClock === "function") drawClock();
  }

  function getDate() {
    return date;
  }

  return { addListener, setDate, getDate };
}

export { ultraClock };
