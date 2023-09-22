$(document).ready(function () {
let IMPORTED_SAMPLES = [];
let DUPLICATE_SAMPLES = [];
let load_flag = false;
const timer = (ms) => new Promise((res) => setTimeout(res, ms));

const table_mgr = {
  destroy: () => {
    const import_table = document.querySelector("#import-tbl");
    if (import_table != undefined) $(import_table).bootstrapTable("destroy");

    const history_table = document.querySelector("#history-tbl");
    if (history_table != undefined) $(history_table).bootstrapTable("destroy");

    delete IMPORTED_SAMPLES;
    delete DUPLICATE_SAMPLES;
  },
};

const import_handlers = {
  connect_events: () => {
    const items = document.querySelectorAll("#import-card .dropdown-item");
    let attribs = [
      "webkitdirectory",
      "mozdirectory",
      "msdirectory",
      "odirectory",
      "directory",
    ];

    // REST IMPORT TABLE
    const import_table = document.querySelector("#import-tbl");
    $(import_table).bootstrapTable("destroy");
    $(import_table).bootstrapTable({
      onResetView: function (e) {
        import_handlers.connect_cell_events();
        import_handlers.show_duplicate_rows(DUPLICATE_SAMPLES);
        import_handlers.reset_form_cells();
      },
    });

    // TOOLBAR EVENTS
    for (const btn of document.querySelectorAll(
      "#import-card .nav-link"
    )) {
      $(btn).on('click',function (event) {
        const action = $(this).data("action");
        let open_browser = false;
        console.log(action);
        if (action == "add-files") {
          attribs.map(function (d) {
            $(ch_inpt).removeAttr(d);
          });
          $(ch_inpt).attr("multiple", "");
          $(ch_inpt).attr("accept", ".gz");
          $(ch_inpt).attr("data-type", "file");
          open_browser = true;
        } else if (action == "add-folder") {
          attribs.map(function (d) {
            $(ch_inpt).attr(d, "");
          });
          $(ch_inpt).removeAttr("multiple");
          $(ch_inpt).removeAttr("accept");
          $(ch_inpt).attr("data-type", "folder");
          open_browser = true;
        } else if (action=="removeAll") {
          $(import_table).bootstrapTable(action);
          IMPORTED_SAMPLES = [];
          DUPLICATE_SAMPLES = [];
          $(ch_inpt).val("");
        } else {
          $(import_table).bootstrapTable(action);
        }
        if (open_browser) {
          ch_inpt.click();
          const import_table = document.querySelector("#import-tbl");
          $(import_table).bootstrapTable("showLoading");
        }
        event.preventDefault();
      });
    }

    // BROWSE FOLDERS/FILES EVENTS
    const ch_inpt = document.querySelector("#choose-dir");

    $(ch_inpt).on("change", function (event) {
      load_flag = true;
      if ($(this).attr("data-type") == "csv") {
        let data = ipcRenderer.sendSync("read-csv", event.target.files[0].path);
        import_handlers.fill(data);
      } else {
        import_handlers.parse_files(event);
      }
      $(this).val("");
      load_flag = false;

      
    });

    window.addEventListener("focus", function (event) {
      setTimeout(() => {
        if (!load_flag) {
          $("#import-tbl").bootstrapTable("hideLoading");
        }
      }, 1000);
    });

    // SUBMIT BUTTON
    const submit_btn = document.querySelector("#submit-btn");
    $(submit_btn).click(function () {
      const tbl_content = import_handlers.to_csv();

      if (tbl_content.row_nr > 0) {
        import_handlers.show_msg("Submitting samples...", "info", true, 5000);

        const filename =
          "_tmp_input_" +
          new Date().toJSON().slice(0, 19).replace(/[-:]/g, "") +
          ".csv";

        ipcRenderer.send("submit-sequence", {
          content: csv_content,
          name: filename,
        });
        import_handlers.del_rows();
      } else {
        import_handlers.show_msg("Invalid input.", "danger", true, 1000);
      }
    });
  },
  connect_cell_events: () => {
    // PASTE VALUES DOWN
    const paste_dates = document.querySelectorAll(
      "#import-tbl .paste-input-down"
    );
    for (const it of paste_dates) {
      it.addEventListener("click", function (event) {
        const table = $(this).parents().eq(5);
        let val = $(this).parents().eq(1).children("input").val();
        let col = $(this).parents().eq(1).children("input").attr("data-col");

        if (val.length > 0) {
          let set_index = parseInt($(this).parents().eq(3).attr("data-index"));
          const rows = document.querySelectorAll("#import-tbl tr");
          const ids = [];
          for (const row of rows) {
            let idx = parseInt($(row).attr("data-index"));

            if (idx >= set_index) {
              ids.push($(row.querySelector(`.${col}`)).attr("id"));
              $(table).bootstrapTable("updateCell", {
                index: idx,
                field: `v_${col}`,
                value: val,
                reinit: false,
              });
            }
          }
          for (const idd of ids) {
            $(`#${idd}`).val(val);
          }
        }
        event.preventDefault();
      });
      // MANUALLY ENTER VALUES IN THE CELL
      let input = $(it).parents().eq(1).children("input");
      $(input).on("focusout", function (event) {
        const table = $(this).parents().eq(4);
        const idx = $(this).parents().eq(2).attr("data-index");
        const col = $(this).attr("data-col");
        const val = $(this).val();
        $(table).bootstrapTable("updateCell", {
          index: idx,
          field: `v_${col}`,
          value: val,
          reinit: false,
        });
      });
    }

    // DELETE ROWS
    const delete_rows = document.querySelectorAll("#import-tbl .delete-row");
    for (const it of delete_rows) {
      it.addEventListener("click", function (event) {
        const table = $(this).parents().eq(3);
        const sample = $(this).data("sample");
        $(table).bootstrapTable("remove", {
          field: "sample",
          values: [sample],
        });

        const idx = IMPORTED_SAMPLES.indexOf(sample);
        if (idx > -1) {
          IMPORTED_SAMPLES.splice(idx, 1);
        }
        event.preventDefault();
      });
    }
  },
  fill: (data) => {
    const import_table = document.querySelector("#import-tbl");

    let tmp = data.length;
    data = data.filter(function (f) {
      return !IMPORTED_SAMPLES.includes(f.sample);
    });

    if (tmp != data.length) {
      import_handlers.show_msg("Duplicate samples are ignored.", "danger");
    }

    if (data.length == 0) {
      return;
    }

    $(import_table).bootstrapTable("hideLoading");
    let rr,
      dlen = data.length;
    for (let i = 0; i < dlen; i++) {
      rr = data[i];
      IMPORTED_SAMPLES.push(rr.sample);
      rr["v_collection_date"] = rr.collection_date;
      rr.collection_date = import_handlers.get_date_cell(
        `collection_date-${rr.sample}`,
        "collection_date"
      );
  
      rr.rm = `<a class="delete-row" href="#" data-sample="${rr.sample}" title="Delete row" > <i class="fa fa-trash" aria-hidden="true"></i></a>`;
      $(import_table).bootstrapTable("insertRow", { index: 0, row: rr });
    }

    for (let i = 0; i < dlen; i++) {
      let sm = data[i].sample;
      $(`#collection_date-${sm}`).datepicker(
        "update",
        data[i].v_collection_date
      );
    
    }
  },
  parse_files: (event) => {

    let filtered_files = Array.from(event.target.files).filter(function (f) {
      
      let p = f.name.split(".");
      let ext = p[p.length - 1];
      valid_exts = ["gz"];
      return valid_exts.includes(ext);
    });
  

    let files_js = filtered_files.map(function (f) {
      let sm = f.name.split(".")[0].replace(/_[1|2]$/, "")
      let pp = sm.split('_')
      const y = '20' + pp[0].substring(0, 2);
      const m = pp[0].substring(2, 4);
      const d = pp[0].substring(4, 6);
      let dt_str = `${y}-${m}-${d}`
      let dt = dt_str, sample = pp[1];
      if(!isValidDate(dt_str)){
        dt = "";
        sample = sm;
      }
     
      return {
        sample: sample ,
        name: f.name.split(".")[0],
        collection_date: dt,
        file1: f.name,
        file2: null,
      };
    });
    
    let out_json = [];
    while (files_js.length > 0) {
      it = files_js.pop();
      
      let found = false;
      for (let i = 0; i < files_js.length; i++) {
        if (files_js[i].sample == it.sample) {
          if (it.name.endsWith("_1") && files_js[i].name.endsWith("_2")) {
            append_paired_end(it, files_js[i], i);
            found = true;
            break;
          } else if (
            it.name.endsWith("_2") &&
            files_js[i].name.endsWith("_1")
          ) {
            append_paired_end(files_js[i], it, i);
            found = true;
            break;
          }
        }
      }
      
    }
    function isValidDate(dateString) {
        const date = new Date(dateString);
        return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/) !== null;
    }
    function append_paired_end(read_1, read_2, rm_idx) {
      read_1.file2 = read_2.file1;
      read_1.seq_rep = "paired";
      delete read_1["name"];
      out_json.push(read_1);
      files_js.splice(rm_idx, 1);
    }
   
   console.log(out_json);
    import_handlers.fill(out_json);
  },
  get_date_cell: (id, type) => {
    return `
    <div class="input-group input-group-sm border-0 m-0"> 
        <input id="${id}" type="text" class="form-control form-control-sm ${type}" data-col="${type}" data-provide="datepicker" data-date-format="yy-mm-dd">
  </div>`;
  },
  get_input_cell: (id, type) => {
    return `
  <div class="input-group input-group-sm border-0 m-0">
      <input id="${id}" type="text" class="form-control form-control-sm ${type}" data-col="${type}">
</div>`;
  },
  reset_form_cells: () => {
    let data = $("#import-tbl").bootstrapTable("getData");
    let header = ["collection_date"];
    data.forEach((row) => {
      header.forEach((d, i) => $(`#${d}-${row["sample"]}`).val(row[`v_${d}`]));
    });
  },
  del_rows: async () => {
    const import_table = document.querySelector("#import-tbl");
    const tbody = import_table.querySelector("tbody");
    let index = 0,
      row,
      sm;
    while (index < IMPORTED_SAMPLES.length) {
      row = tbody.children[index];
      sm = row.children[1].innerText;
      if (!DUPLICATE_SAMPLES.includes(sm)) {
        $(row).addClass("table-row-success").addClass("m-fadeOut");
        await timer(100);
        $(import_table).bootstrapTable("remove", {
          field: "$index",
          values: [index],
        });
        const idx = IMPORTED_SAMPLES.indexOf(sm);
        if (idx > -1) {
          IMPORTED_SAMPLES.splice(idx, 1);
        }
      } else {
        index += 1;
      }
    }
  },
  show_duplicate_rows: (samples) => {
    if (samples.length == 0) return;

    for (const sample of samples) {
      if (!DUPLICATE_SAMPLES.includes(sample)) {
        DUPLICATE_SAMPLES.push(sample);
      }

      const td = Array.from(
        document.querySelectorAll("#import-tbl tr td")
      ).find((el) => el.textContent === sample);
      if (td != undefined) {
        const row = td.parentElement;
        $(row).addClass("table-row-error");
        let i = 0;
        let ll = row.querySelectorAll("td").length;
        for (const td of row.querySelectorAll("td")) {
          if (i == 2) {
            td.innerText =
              "-Error: The sample has been analyzed before. Please remove it or change the filenames.";
            $(td).attr("colspan", ll - 3);
          }
          if (i > 2 && i < ll - 1) {
            td.style = "display:none";
          }
          i += 1;
        }
      }
    }
  },
  show_msg: (msg, type, auto_hide = true, delay = 3000) => {
    let icon, text;
    if (type == "danger") {
      icon = "fa-exclamation-triangle";
      text = "text-danger";
    } else if (type == "info") {
      icon = "fa-info-circle";
      text = "text-info";
    }
    $("#import-table-msg").removeClass("text-info").removeClass("text-danger");
    $("#import-table-msg").addClass(text);
    $("#import-table-msg").html(`<i class="fa fa-fw ${icon}"></i> ${msg}`);
    $("#import-table-msg").addClass("m-fadeIn");

    if (auto_hide) {
      setTimeout(function () {
        $("#import-table-msg").removeClass("m-fadeIn").addClass("m-fadeOut");
      }, delay);
    }
  },
  custom_sorter: (a, b) => {
    let a_id = $($.parseHTML(a)).find("input").attr("id");
    let b_id = $($.parseHTML(b)).find("input").attr("id");
    let a_val = $(`#${a_id}`).val();
    let b_val = $(`#${b_id}`).val();
    console.log(a_val);
    a_val = a_val == undefined ? "" : a_val;
    b_val = b_val == undefined ? "" : b_val;

    return ("" + a_val).localeCompare(b_val);
  },
};



function custom_sorter(a, b) {
  return import_handlers.custom_sorter(a, b);
}

// Function calls
import_handlers.connect_events();


});