var TableEventTypeEnum = {
  EDIT : "table_event_type_edit",
  NEW : "table_event_type_new",
  DELETE : "table_event_type_delete"
}

// Represents some sort of modification the user makes
// to the table.
function TableEvent(eventType, rowId, rowData) {
  this.eventType = eventType;
  this.rowId = rowId;
  this.rowData = rowData;
}

// Database is really a "view" onto the SQL.
// It's not guaranteed to be consistent all the time though,
// because it will issue POSTS and GETS to update the actual SQL.
function Database (id, catlogUrl, functionOnSuccessfulCreation) {
  this.id = id;
  this.catlogUrl = catlogUrl;
  this.rowData = {};
  this.nextRowId = 0;
  this.functionOnSuccessfulCreation = functionOnSuccessfulCreation;

  var self = this;

  // Use a GET to get all existing rows into this database.
  $.getJSON(catlogUrl + "rows/all/", function(data) {
    // "data" will be a JSON representation
    // of the rows.

    var rows = data['rows'];
    var rowIndex = 0;
    var largestId = -1;
    for (;rowIndex < rows.length; ++rowIndex) {
      var rowId = rows[rowIndex]['rowId'];

      if (rowId > largestId) {
        largestId = rowId;
      }

      self.rowData[rowId] = {};

      self.rowData[rowId]["name"] = rows[rowIndex]["name"];
      self.rowData[rowId]["count"] = rows[rowIndex]["count"];
      self.rowData[rowId]["description"] = rows[rowIndex]["description"];
    }

    self.nextRowId = largestId + 1;

    self.functionOnSuccessfulCreation();
  });
}

Database.prototype = {
  constructor:Database,

  addRow:function(columnValues) {
    var newRowId = this.nextRowId++;

    this.rowData[newRowId] = columnValues;

    var addEvent = new TableEvent(
      TableEventTypeEnum.NEW,
      newRowId,
      {
        'name' : columnValues["name"],
        'count': columnValues["count"],
        'description': columnValues["description"]
        }
      );

    addTableEventToPostQueue(
      addEvent
    );
    },

  editRow:function(rowId, column_name, newValue) {
    this.rowData[rowId][column_name] = newValue;

    var columnValues = this.rowData[rowId];

    var editEvent = new TableEvent(
      TableEventTypeEnum.EDIT,
      rowId,
      {
        'name' : columnValues["name"],
        'count': columnValues["count"],
        'description': columnValues["description"]
        }
      );

    addTableEventToPostQueue(
      editEvent
    );
  },

  deleteRow:function(rowId) {
    delete this.rowData[rowId];

    var deleteEvent = new TableEvent(
      TableEventTypeEnum.DELETE,
      rowId,
      {}
      );

    addTableEventToPostQueue(
      deleteEvent
    );
  },

  getRowData:function() {
    return this.rowData;
  },

  getNumberOfRows:function() {
    var count = 0;
    for (id in this.rowData) {
      count++;
    }

    return count;
  },

  generateCsv:function(includeName, includeCount, includeDescription) {
    var csvData = '';

    for (rowIndex in this.rowData) {
      thisRowData = this.rowData[rowIndex];

      if (includeName) {
        csvData += thisRowData["name"];
      }

      if (includeCount) {
        csvData += ", " + thisRowData["count"];
      }

      if (includeDescription) {
        csvData += ", " + thisRowData["description"];
      }

      csvData += "\n";
    }

    return csvData;
  },

  getNextLogicalRowForSelection:function(rowId) {
    var closestIdSoFar = -1;
    var minDifferenceToClosestId = Number.MAX_SAFE_INTEGER;

    if (rowId != -1) {
      for (id in this.rowData) {
        var currentDifferenceToClosestId = Math.abs(parseInt(id) - parseInt(rowId));

        if (currentDifferenceToClosestId == 0) {
          // Don't select the same row.
          continue;
        }

        if (currentDifferenceToClosestId < minDifferenceToClosestId) {
          minDifferenceToClosestId = currentDifferenceToClosestId;
          closestIdSoFar = id;
        }
      }
    }

    if (closestIdSoFar == -1) {
      var largestId = 0;
      for (id in this.rowData) {
        if (id > largestId) {
          largestId = id;
        }
      }

      closestIdSoFar = largestId;
    }

    return closestIdSoFar;
  }
}

currentDatabase = null;

selectedRowId = -1;
settingsData = {};

// These are used to store all cells in a particular column.
tableColumnsCells = {};

// Stores a ordered queue of table events, events
// are removed from the queue as they are POSTed to the
// server.
tableEventPostQueue = [];
var POST_TABLE_EVENT_QUEUE_PERIOD_MS = 5e3;

// Store the elements used for the modal.
var share_modal = document.getElementById('share-modal-div');

window.onbeforeunload = function() {
  // Before the user leaves, save any unsynchronised
  // changes.
  postTableEventQueue();

  // return 'Are you sure you want to leave?';
}

window.onclick = function(event) {
    if (event.target == share_modal) {
        closeShareModalDialog();
    }
}

var main = function() {
  // using jQuery setup the CSRF token.
  function getCookie(name) {
      var cookieValue = null;
      if (document.cookie && document.cookie !== '') {
          var cookies = document.cookie.split(';');
          for (var i = 0; i < cookies.length; i++) {
              var cookie = jQuery.trim(cookies[i]);
              // Does this cookie string begin with the name we want?
              if (cookie.substring(0, name.length + 1) === (name + '=')) {
                  cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                  break;
              }
          }
      }
      return cookieValue;
  }
  var csrftoken = getCookie('csrftoken');

  function csrfSafeMethod(method) {
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
  }
  $.ajaxSetup({
      crossDomain: false,
      beforeSend: function(xhr, settings) {
          if (!csrfSafeMethod(settings.type)) {
              xhr.setRequestHeader("X-CSRFToken", csrftoken);
          }
      }
  });

  // Check we actually have a mainDatabaseId and a mainDatabaseUrl.
  if (typeof mainDatabaseId === 'undefined' || typeof mainDatabaseUrl === 'undefined') {
    alert("Error: the clientside script could not find the main database ID or URL.");
  }

  // Create the database.
  currentDatabase = new Database(mainDatabaseId, mainDatabaseUrl, function() {
    // If there are rows, set the selected row id.
    if (currentDatabase.getNumberOfRows() > 0) {
      selectedRowId = currentDatabase.getNextLogicalRowForSelection(-1);
    }
    redrawTable();
  });
}

$(document).ready(function(){
  main();

  // Setup the copy to clipboard button.
  function setTooltip(btn, message) {
    $(btn).tooltip('show')
      .attr('data-original-title', message)
      .tooltip('show');
  }

  function hideTooltip(btn) {
      $(btn).tooltip('hide');
  }

  copyToClipboardButtonClipboard = new Clipboard('#copy-to-clipboard-button');
  copyToClipboardButton = $("#copy-to-clipboard-button");

  copyToClipboardButton.tooltip({
    trigger: 'manual',
    placement: 'bottom'
  });


  copyToClipboardButtonClipboard.on('success', function(e) {
    setTooltip(copyToClipboardButton, 'Copied!');
    e.clearSelection();
  });


  copyToClipboardButton.mouseleave(function(e) {
    setTimeout(function() {
      hideTooltip(copyToClipboardButton);
    }, 100);
  })

  copyToClipboardButton.on('error', function(e) {
    setTooltip(e.trigger, 'Failed!');
    hideTooltip(e.trigger);
  });

  // The search bar should auto-focus on page load.
  $('#search-text-input').focus();

  // For all input elements of type checkbox that have an ID containing
  // 'settings-checkbox', add the settings checkbox listener to them.
  $(":checkbox[id*='settings-checkbox']").click(settingsCheckboxListener);

  // Call the listener function on each checkbox to initialise the settings data.
  $(":checkbox[id*='settings-checkbox']").each(settingsCheckboxListener);


    // Periodically POST the queue of table events.
    setInterval(postTableEventQueue, POST_TABLE_EVENT_QUEUE_PERIOD_MS);
});

$('#search-button-plus').on('click', searchButtonPlusClicked);
$('#search-button-minus').on('click', searchButtonMinusClicked);
$('#search-button-clear').on('click', clearSearchText);

$('#table-button-share').on('click', openShareModalDialog);
$('.share-modal-close').on('click', closeShareModalDialog);

$('#table-button-download').on('click', searchButtonSettingsClicked);
$(document).on("click", "#catlog-table tbody tr", catlogTableRowClicked);

// Whenever a count widget changes, update the database.
$(document).on("change", ".catlog-row-count", changedTableRowCount);

// Whenever a description widget changes, update the database.
$(document).on("change", ".catlog-row-description", changedTableRowDescription);

$("#search-text-input").keyup(function(event){
    if(event.keyCode == 13){
        // When the user presses enter in the search field,
        // treat that as a "plus/add" click.
        searchButtonPlusClicked();
    }

    // Move the selected row to be the first row.
    selectedRowPhysicalIndex = 0;
});

$("#search-text-input").bind('input', changedSearchText);

function addTableEventToPostQueue(tableEventObject) {
  // Maintains a queue of events that are things that the
  // user has done to the table.

  tableEventPostQueue.push(tableEventObject);
}

function postTableEventQueue() {
  console.log("posting...");

  if (tableEventPostQueue.length > 0) {
    var tableEventPostQueueJson = JSON.stringify(tableEventPostQueue);

    console.log(tableEventPostQueueJson);

    $.post(mainDatabaseUrl + "rows/update/", tableEventPostQueueJson)
      .done(function (data) {
        // Done. Clear the queue.
        tableEventPostQueue.length = 0;
        console.log("posted");
      })
      .fail(function() {
        console.log("fail");
      });
  }
}

function openShareModalDialog() {
  share_modal.style.display = "block";
}

function closeShareModalDialog() {
  share_modal.style.display = "none";
}

function catlogTableRowClicked(event) {
  // Remove the selected class from all rows.
  $("#catlog-table tbody tr").removeClass("selected-catlog-row");

  var rowElement = $(this);

  var children = rowElement.children();

  if (0 in children) {
    selectedRowId = children[0].innerText;
  } else {
    selectedRowId = currentDatabase.getNextLogicalRowForSelection(-1);
  }

  // Add the selected class to the new selected row.
  rowElement.addClass("selected-catlog-row");
}

function changedTableRowCount(event) {
  var inputElement = $(this);
  var inputData = inputElement.val();
  var rowElement = inputElement.parents("tr");
  var children = rowElement.children();
  var rowId = -1;

  if (0 in children) {
    rowId = children[0].innerText;
  } else {
    console.log("Could not get the index of the edited row...");
    rowId = currentDatabase.getNextLogicalRowForSelection(-1);
  }

  console.log(rowId);
  currentDatabase.editRow(rowId, "count", inputData);
}

function changedTableRowDescription(event) {
  var inputElement = $(this);
  var inputData = inputElement.val();
  var rowElement = inputElement.parents("tr");
  var children = rowElement.children();
  var rowId = -1;

  if (0 in children) {
    rowId = children[0].innerText;
  } else {
    console.log("Could not get the index of the edited row...");
    rowId = currentDatabase.getNextLogicalRowForSelection(-1);
  }

  console.log(rowId);
  currentDatabase.editRow(rowId, "description", inputData);
}

function changedSearchText(event) {
  var searchText = $(this).val();

  // If the search text is not empty, show the little clear button.
  if (searchText != '') {
    $('#search-button-clear').fadeIn("fast", function() {});
  } else {
    $('#search-button-clear').fadeOut("fast", function() {});
  }

  // Narrow down the results and re-draw the table.
  redrawTable(searchText);
}

function clearSearchText() {
  $('#search-text-input').val('');
  $('#search-button-clear').fadeOut("fast", function() {});
  redrawTable();
}

function searchButtonPlusClicked() {
  var searchQuery = $('#search-text-input').val();

  currentDatabase.addRow({"name": searchQuery, "count": 0, "description": ""});

  // If there are rows, set the selected row id.
  if (currentDatabase.getNumberOfRows() > 0 && selectedRowId == -1) {
    selectedRowId = currentDatabase.getNextLogicalRowForSelection(-1);
  }

  clearSearchText();
}

function searchButtonMinusClicked() {
  var newSelectedRowId = currentDatabase.getNextLogicalRowForSelection(selectedRowId);

  // Delete the currently selected row from the database.
  console.log(selectedRowId);
  currentDatabase.deleteRow(selectedRowId);

  selectedRowId = newSelectedRowId;

  clearSearchText();
}

function searchButtonSettingsClicked() {
  var nameShowing = true;
  var countShowing = (settingsData["count"] || false);
  var descriptionShowing = (settingsData["description"] || false);

  // Generate the CSV data.
  var csvData = currentDatabase.generateCsv(
    nameShowing,
    countShowing,
    descriptionShowing
  );

  // Generate a date to use with the filename.
  var d = new Date();

  var month = d.getMonth()+1;
  var day = d.getDate();
  var dateString = d.getFullYear() +
    (month<10 ? '0' : '') + month +
    (day<10 ? '0' : '') + day;

  this.download = 'catlog-' + dateString + '.csv';

  this.href = 'data:text/csv;charset=UTF-8,' +
  encodeURIComponent(csvData);

}

function settingsCheckboxListener(event) {
  var settingsCheckboxId = this.id.substr(18);

  // Show or hide the relevant table rows. Just hide them.
  var settingName = this.id.substr(18);

  // Update the settings data.
  settingsData[settingName] = this.checked;

  if (tableColumnsCells.hasOwnProperty(settingName)) {

    var tableColumn = tableColumnsCells[settingName];
    var columnIsShowing = settingsData[settingName];

    for (var i = 0; i < tableColumn.length; ++i) {
      var cellElement = tableColumn[i];

      var target = (columnIsShowing ? "100%" : "0px");

      // cellElement.element.animate({ width:target });
      if (columnIsShowing) {
        cellElement.element.show();
      } else {
        cellElement.element.hide();
      }
    }
  }
}

function rowMatchesQuery(thisRowData, queryString) {
  var lowerCaseRowData = thisRowData["name"].toLowerCase();
  var lowerCaseQueryString = queryString.toLowerCase();

  return (lowerCaseRowData.includes(lowerCaseQueryString) ||
          lowerCaseQueryString.includes(lowerCaseRowData));
}
 
// Redraws the HTML table that shows the rowData.
// TODO: Maybe use styles to only hide the rows that aren't relevant?
// Would this work?
function redrawTable(queryString) {
  var drawWholeTable = false;

  // If the user didn't supply a query string (or the query is empty)
  // draw the whole table.
  if (typeof(queryString) === 'undefined' || queryString == '') {
    queryString = '';
    drawWholeTable = true;
  }

  var rowsHtml = '';
  indicesShowingInOrder = [];

  var databaseRowData = currentDatabase.getRowData();

  for (rowId in databaseRowData) {
    var rowValues = databaseRowData[rowId];

    // If we aren't drawing the whole table, check if this row matches
    // the required query.
    if (drawWholeTable || rowMatchesQuery(rowValues, queryString)) {
      var rowHtml = '<tr>';

      // Shade the selected row.
      if (rowId == selectedRowId) {
        rowHtml = '<tr class="selected-catlog-row">';
      }

      // Add the "id" HTML.
      rowHtml += '<td><div>' + rowId + '</div></td>';

      // Add the "name" HTML.
      rowHtml += '<td><div>' + rowValues["name"] + '</div></td>';

      // Add the "count" HTML.
      rowHtml += '<td><div class="table-column-count">'
      + '<input class="catlog-row-count form-control" value="'
      + rowValues["count"]
      + '"/>'
      + '</div></td>';

      // Add the "description" HTML.
      rowHtml += '<td><div class="table-column-description">'
      + '<input class="catlog-row-description form-control" type="text" value="'
      + rowValues["description"]
      + '"/>'
      + '</div></td>';

      rowsHtml += rowHtml + '</tr>';
    }
  }

  $('#catlog-table tbody').html(rowsHtml);

  // Add the number spinner widget into rows that have counts.
  $('.table-column-count > input').bootstrapNumber({
  	upClass: 'success',
  	downClass: 'danger'
  });

  // Now re-assign the new columns to our set of columns that
  // we can animate.
  $(".table-column-count, .table-column-description").each(function(){
    var tableColumnCellElement = {};
    var settingName = $(this).attr('class').substr(13);

    tableColumnCellElement.element = $(this);

    if (tableColumnsCells[settingName] === undefined) {
      tableColumnsCells[settingName] = []
    }
    tableColumnsCells[settingName].push(tableColumnCellElement);
  });

  // Now either show or hide the relevant columns.
  for (var settingName in tableColumnsCells) {
    if (tableColumnsCells.hasOwnProperty(settingName)) {
      var tableColumn = tableColumnsCells[settingName];
      var columnIsShowing = settingsData[settingName];

      for (var i = 0; i < tableColumn.length; ++i) {
        var cellElement = tableColumn[i];

        var target = (columnIsShowing ? "100%" : "0px");

        // cellElement.element.animate({ width:target });
        if (columnIsShowing) {
          cellElement.element.show();
        } else {
          cellElement.element.hide();
        }
      }
    }
  }
}
