$(document).ready(function () {
    let IMPORTED_SAMPLES = [];
    let DUPLICATE_SAMPLES = [];
    let Overview_data;
    let load_flag = false;
    let isJobRunning = false;
    let jobStatusInterval;
    let interval = 1000, interval_step = 5000, interval_max = 60 * 1000;
    const timer = (ms) => new Promise((res) => setTimeout(res, ms));


    function init() {
        $(window).resize(function () {
            plot_temporal_dist(Overview_data.samples)
        });

        request_overview_data();
        generate_overview_stats();

    }


    //IMPORT SECTION
    function import_connect_events() {

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
                import_connect_cell_events();
                import_show_duplicate_rows(DUPLICATE_SAMPLES);
                import_reset_form_cells();
            },
        });

        // TOOLBAR EVENTS
        for (const btn of document.querySelectorAll(
            "#import-card .nav-link"
        )) {
            $(btn).on('click', function (event) {
                const action = $(this).data("action");
                let open_browser = false;
                if (action === "submit") return;
                if (action === "add-files") {
                    attribs.map(function (d) {
                        $(ch_inpt).removeAttr(d);
                    });
                    $(ch_inpt).attr("multiple", "");
                    $(ch_inpt).attr("accept", ".gz");
                    $(ch_inpt).attr("data-type", "file");
                    open_browser = true;
                } else if (action === "add-folder") {
                    attribs.map(function (d) {
                        $(ch_inpt).attr(d, "");
                    });
                    $(ch_inpt).removeAttr("multiple");
                    $(ch_inpt).removeAttr("accept");
                    $(ch_inpt).attr("data-type", "folder");
                    open_browser = true;
                } else if (action === "removeAll") {
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
            import_parse_files(event);
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

        });

    }

    function import_connect_cell_events() {
        // PASTE VALUES DOWN
        const paste_dates = document.querySelectorAll(
            "#import-tbl .paste-input-down"
        );
        for (const it of paste_dates) {

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
                // remove from sample
                const idx = IMPORTED_SAMPLES.indexOf(sample);
                if (idx > -1) {
                    IMPORTED_SAMPLES.splice(idx, 1);
                }

                event.preventDefault();
            });
        }
    }

    function import_fill(data) {
        const import_table = document.querySelector("#import-tbl");
        if (data.length === 0) {
            return;
        }

        $(import_table).bootstrapTable("hideLoading");
        let rr,
            dlen = data.length, tmp = 0;

        for (let i = 0; i < dlen; i++) {
            rr = data[i];
            if (IMPORTED_SAMPLES.includes(rr.sample)) {
                tmp += 1
                continue;
            }
            IMPORTED_SAMPLES.push(rr.sample);
            rr["v_collection_date"] = rr.collection_date;
            rr.collection_date = import_get_date_cell(
                `collection_date-${rr.sample}`,
                "collection_date"
            );

            rr.rm = `<a class="delete-row" href="#" data-sample="${rr.sample}" title="Delete row" > <i class="fa fa-trash" aria-hidden="true"></i></a>`;
            $(import_table).bootstrapTable("insertRow", {index: 0, row: rr});
        }
        if (tmp > 0) {
            import_show_msg(`${tmp} sample${tmp === 1 ? ' was' : 's were'} ignored due to causing duplication in the table.`, "danger", 10000);
        }
        for (let i = 0; i < dlen; i++) {
            let sm = data[i].sample;
            $(`#collection_date-${sm}`).datepicker(
                "update",
                data[i].v_collection_date
            );

        }
    }

    function import_parse_files(event) {

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
            if (!isValidDate(dt_str)) {
                dt = "";
                sample = sm;
            }
            return {
                sample: sample,
                name: f.name.split(".")[0],
                collection_date: dt,
                file1: f.name,
                file2: null,
                fobj1: f,
                fobj2: null,
            };
        });

        let out_json = [];
        while (files_js.length > 0) {
            let it = files_js.pop();

            let found = false;
            for (let i = 0; i < files_js.length; i++) {
                if (files_js[i].sample === it.sample) {
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
            read_1.fobj2 = read_2.fobj1;
            delete read_1["name"];
            out_json.push(read_1);
            files_js.splice(rm_idx, 1);
        }

        import_fill(out_json);
    }

    function import_get_date_cell(id, type) {
        return `
    <div class="input-group input-group-sm border-0 m-0"> 
        <input id="${id}" type="text" class="form-control form-control-sm ${type}" data-col="${type}" data-provide="datepicker" data-date-format="yy-mm-dd">
  </div>`;
    }

    function import_reset_form_cells() {
        let data = $("#import-tbl").bootstrapTable("getData");
        let header = ["collection_date"];
        data.forEach((row) => {
            header.forEach((d, i) => $(`#${d}-${row["sample"]}`).val(row[`v_${d}`]));
        });
    }

    function import_show_duplicate_rows(samples) {
        if (samples.length === 0) return;

        for (const sample of samples) {
            if (!DUPLICATE_SAMPLES.includes(sample)) {
                DUPLICATE_SAMPLES.push(sample);
            }

            const td = Array.from(
                document.querySelectorAll("#import-tbl tr td")
            ).find((el) => el.textContent === sample);
            if (td !== undefined) {
                const row = td.parentElement;
                $(row).addClass("table-row-error");
                let i = 0;
                let ll = row.querySelectorAll("td").length;
                for (const td of row.querySelectorAll("td")) {
                    if (i === 2) {
                        td.innerHTML =
                            "<span class='text-danger .font-weight-lighter'>This sample will be ignored as it has been previously analyzed. " +
                            "Please consider removing this row or importing the sequences with different sample name.</span>";
                        $(td).attr("colspan", ll - 2);
                    }
                    if (i > 2 && i < ll) {
                        td.style = "display:none";
                    }
                    i += 1;
                }
            }
        }
    }

    function import_show_msg(msg, type, auto_hide = true, delay = 3000) {
        let icon, text;
        let msg_el = document.getElementById("import-table-msg")
        if (type === "danger") {
            icon = "fa-exclamation-triangle";
            text = "text-danger";
        } else if (type === "info") {
            icon = "fa-info-circle";
            text = "text-info";
        }
        $(msg_el).removeClass("text-info")
            .removeClass("text-danger")

        $(msg_el).addClass(text);
        $(msg_el).html(`<i class="fa fa-fw ${icon}"></i> ${msg}`);
        $(msg_el).addClass("m-fadeIn");

        if (auto_hide) {
            setTimeout(function () {
                $(msg_el).removeClass("m-fadeIn")
                    .addClass("m-fadeOut");
            }, delay);
        }
    }

    function custom_sorter(a, b) {
        let a_id = $($.parseHTML(a)).find("input").attr("id");
        let b_id = $($.parseHTML(b)).find("input").attr("id");
        let a_val = $(`#${a_id}`).val();
        let b_val = $(`#${b_id}`).val();
        a_val = a_val === undefined ? "" : a_val;
        b_val = b_val === undefined ? "" : b_val;

        return ("" + a_val).localeCompare(b_val);
    }

    // UPLOAD SECTION
    class Uploader {
        constructor(files) {
            this.ticket = util_get_random()
            this.files = files;
            this.max_length = 10 * 1024 * 1024; // 10 mb
            this.attempts = 5;
            this.uploaded_files = {};
            this.uploaded_samples_count = 0;
        }

        upload() {
            this.initFileUpload();
        }

        initFileUpload() {
            if (this.files.length > 0) {
                let f = this.files[this.files.length - 1]
                this.file = f.file;

                // load meta-data
                this.sample = f.sample;
                this.read = f.read;
                this.cdate = f.cdate;

                timer(1000).then(r => {
                    upload_setup_progressbar(this.file.name);
                    this.upload_file(0, null);
                });
            } else {
                upload_setup_progressbar();
                util_toggle_panel('import')
                this.reset_attempts()


                if (this.uploaded_samples_count > 0) {
                    //submitting the job
                    //*******
                    this.submit_jobs(this.uploaded_samples_count)
                }
            }


        }

        reset_attempts() {
            this.attempts = 5;
        }

        upload_file(start, path) {

            var end;
            var self = this;
            var existingPath = path;
            var formData = new FormData();
            var nextChunk = start + this.max_length + 1;
            var currentChunk = this.file.slice(start, nextChunk);
            var uploadedChunk = start + currentChunk.size

            //should be deleted, will keep it for future verification
            var error = false;//Math.random() > 0.98;

            if (uploadedChunk >= this.file.size) {
                end = 1;
            } else {
                end = 0;
            }
            formData.append('file', currentChunk);
            formData.append('sample', this.sample);
            formData.append('cdate', this.cdate);
            formData.append('read', this.read);
            formData.append('end', end);
            formData.append('existingPath', existingPath);
            formData.append('nextSlice', nextChunk);


            formData.append('error', error);

            $.ajaxSetup({
                // make sure to send the header
                headers: {
                    "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                }
            });

            $.ajax({
                xhr: function () {
                    var xhr = new XMLHttpRequest();
                    xhr.upload.addEventListener('progress', function (e) {
                        if (e.lengthComputable) {
                            if (self.file.size < self.max_length) {
                                var percent = Math.round((e.loaded / e.total) * 100);
                            } else {
                                var percent = Math.round((uploadedChunk / self.file.size) * 100);
                            }
                            let prog = document.getElementsByClassName("active-progress")
                            $(prog).parent().removeClass('invisible')
                            $(prog).css('width', percent + '%')
                            $(prog).text(percent + '%')

                        }
                    });
                    return xhr;
                },
                url: '/iom/upload/' + this.ticket,
                type: 'POST',
                dataType: 'json',
                cache: false,
                processData: false,
                contentType: false,
                data: formData,
                error: function (xhr) {
                    let prog = document.getElementsByClassName("active-progress");
                    $(prog).removeClass('bg-success').addClass('bg-danger')
                    self.attempts -= 1
                    if (self.attempts < 0) {
                        self.files.pop();
                        self.reset_attempts();
                    }
                    self.initFileUpload()
                },
                success: function (res) {
                    if (nextChunk < self.file.size) {
                        // upload file in chunks
                        existingPath = res.existingPath
                        self.upload_file(nextChunk, existingPath);
                    } else {
                        // upload complete
                        self.reset_attempts();

                        if (self.uploaded_files[self.sample] === undefined) {
                            self.uploaded_files[self.sample] = {"1": false, "2": false}
                        }
                        self.uploaded_files[self.sample][self.read] = true;

                        if (self.uploaded_files[self.sample]["1"] && self.uploaded_files[self.sample]["2"]) {
                            self.uploaded_samples_count += 1;
                            //remove record in the table
                            const import_table = document.querySelector("#import-tbl");
                            $(import_table).bootstrapTable('removeByUniqueId', self.sample);
                            const idx = IMPORTED_SAMPLES.indexOf(self.sample);
                            if (idx > -1) {
                                IMPORTED_SAMPLES.splice(idx, 1);
                            }

                        }

                        self.files.pop();
                        self.initFileUpload()
                    }
                }
            });
        };

        submit_jobs(samples_count) {

            var formData = new FormData();
            formData.append('ticket', this.ticket)
            formData.append('samples_count', samples_count.toString())

            $.ajaxSetup({
                // make sure to send the header
                headers: {
                    "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                }
            });
            $.ajax({
                type: 'POST',
                url: 'enqjob',
                dataType: 'json',
                cache: false,
                processData: false,
                contentType: false,
                data: formData,
                success: function (res) {
                    interval = 2000;
                    if (!isJobRunning) {
                        isJobRunning = true;
                        jobStatusInterval = setInterval(job_send_request, interval);
                    }
                    job_send_request()
                },
                error: function (xhr, errmsg, err) {
                    console.log('ERROR!!!');
                }
            });
        }
    }

    function upload_connect_events() {
        $("#submit-jobs").on('click', function (event) {
            event.preventDefault();

            let files = upload_get_files()
            if (files.length > 0) {
                upload_setup_table(files)
                let uploader = new Uploader(files)
                uploader.upload();
            } else {
                import_show_msg("Kindly begin by importing Illumina files " +
                    "in the pair-end format ({*_1/*_2}.fastq.gz).", "danger", 1e4)
            }

        });

    }

    function upload_get_files() {
        let data = $("#import-tbl").bootstrapTable("getData");

        let files = []
        data.forEach((row) => {
            if (!DUPLICATE_SAMPLES.includes(row.sample)) {
                files.unshift({file: row.fobj1, sample: row.sample, cdate: row.v_collection_date, read: '1'})
                files.unshift({file: row.fobj2, sample: row.sample, cdate: row.v_collection_date, read: '2'})
            }
        });
        return files;
    }

    function upload_setup_progressbar(filename) {

        $(".active-progress").addClass("bg-success").removeClass('active-progress');

        if (filename !== undefined) {
            const td = Array.from(
                document.querySelectorAll("#upload-tbl tr td")
            ).find((el) => el.textContent === filename);

            $(td).next().find(".progress-bar")
                .addClass('active-progress')
                .removeClass("bg-success")
                .removeClass("bg-danger")

        }
    }

    function upload_setup_table(files) {

        util_toggle_panel('upload');
        let upload_tbl = document.getElementById("upload-tbl")
        let progress_bar = `<div class="progress invisible">
                                        <div class="progress-bar" role="progressbar" style="width: 0%;" 
                                        aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                                   </div>`
        $(upload_tbl).bootstrapTable("removeAll");
        files.forEach((fj) => {
            $(upload_tbl).bootstrapTable("insertRow", {
                index: 0,
                row: {filename: fj.file.name, progress: progress_bar}
            });
        });
    }

    function job_update_table(data) {

        const status_icon = {"0": "text-success", '1': "text-danger", '-1': 'blink'}
        const tbl = document.querySelector("#jobs-tbl");
        $(tbl).bootstrapTable("destroy");
        $(tbl).bootstrapTable({
            onResetView: function (e) {
                job_connect_cell_events();
            }
        });
        $(tbl).bootstrapTable('refreshOptions', {classes: "table-sm table-striped"});

        if (data.length === 0) {
            return;
        }
        $(tbl).bootstrapTable("hideLoading");
        let rec;
        for (let i = 0; i < data.length; i++) {
            rec = data[i];
            rec.actions = `<a class="job-log text-secondary" href="#" data-status="${rec.status}" data-ticket="${rec.ticket}" title="view logs" > <i class="fas fa-clipboard-list"></i></a>`;
            rec.status = `<a class="status" data-sample="${rec.id}" title="status" ><i class="fa fa-circle ${status_icon[rec.status]}"></i> </a>`;
            $(tbl).bootstrapTable("insertRow", {index: 0, row: rec});
        }


    }

    function job_connect_cell_events() {
        // connect view logs events
        const status_icon = {"0": "text-success", '1': "text-danger", '-1': 'blink'}
        const tbl = document.querySelector("#jobs-tbl");

        const log_btns = tbl.querySelectorAll(".job-log");
        $(log_btns).each(function (i, it) {

            it.addEventListener("click", function (event) {

                let tkt = $(this).data('ticket');
                let stat = $(this).data('status');
                const mdl = document.getElementById("logmodal");

                $(mdl).find('.modal-title').html(`<a class="status" title="status" ><i class="fa fa-circle ${status_icon[stat]}"></i></a>
                                                                    <span class="text-muted"> Ticket log: <small>${tkt}</small></span>`)
                $(mdl).modal('show');

                timer(1000).then(r => {
                    job_request_log(tkt);
                });

                event.preventDefault();
            })

        });
    }

    function job_request_log(ticket) {
        $.ajax({
            url: 'fetchlog',
            type: 'GET',
            data: {"ticket": ticket},
            success: function (response) {
                // Process the response data
                console.log(response);
                job_fill_log(response['data'])
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.error('Error:', textStatus, errorThrown);
            }
        });
    }

    function job_fill_log(data) {
        const tbl = document.getElementById("log-tbl");
        $(tbl).bootstrapTable('hideLoading')

        let rec;
        let success = `<span class="text-success"> <i class="fas fa-check"></i></span>`
        let failed = `<span class="text-danger"> <i class="fas fa-times"></i></span>`
        for (let i = 0; i < data.length; i++) {
            rec = data[i];
            rec.cryptic = rec.cryptic === '0' ? success : failed;
            rec.tbprofiler = rec.tbprofiler === '0' ? success : failed;
            $(tbl).bootstrapTable("insertRow", {index: 0, row: rec});
        }

    }

    function job_send_request() {
        $.ajaxSetup({
            // make sure to send the header
            headers: {
                "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            }
        });
        $.ajax({
            type: 'POST',
            url: 'fetchjobs',
            success: function (response) {

                if (response.ongoing === 0) {
                    clearInterval(jobStatusInterval);
                    isJobRunning = false;
                } else {
                    interval = Math.min(interval + interval_step, interval_max);
                    isJobRunning = true;
                    clearInterval(jobStatusInterval);
                    jobStatusInterval = setInterval(job_send_request, interval);

                }
                job_update_table(response['data']);
            },
            error: function (xhr, errmsg, err) {
                console.log(xhr.status + ": " + xhr.responseText);
            }
        })
    }

    // UTILITY SECTION
    function util_toggle_panel(mode) {
        let p_hide, p_show;
        if (mode === "upload") {
            p_hide = document.getElementById("import-panel")
            p_show = document.getElementById("upload-panel")

        } else {
            p_show = document.getElementById("import-panel")
            p_hide = document.getElementById("upload-panel")
        }
        $(p_hide).removeClass('m-fadeIn').addClass('m-fadeOut')
        $(p_show).removeClass('m-hide').addClass('m-show')
        timer(500).then(r => {
            $(p_hide).removeClass('m-show').addClass('m-hide')
            $(p_show).removeClass('m-fadeOut').addClass('m-fadeIn')
        })
    }

    function util_get_random(length = 4) {
        // Get the current date and time
        const now = new Date();

        // Extract year, month, day, hour, and minute
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');

        // Create the folder name
        let now_str = `${year}${month}${day}${hour}${minute}`;
        const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
        let rand_str = "";
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            rand_str += charset.charAt(randomIndex);
        }

        return `${now_str}${rand_str}`;
    }

    $('#logmodal').on('shown.bs.modal', function () {
        const tbl = document.getElementById("log-tbl");
        $(tbl).bootstrapTable('destroy');
        $(tbl).bootstrapTable();
        $(tbl).bootstrapTable('refreshOptions', {classes: "table-sm table-borderless"});
        $(tbl).bootstrapTable('showLoading')

    });
    $('#logmodal').on('hidden.bs.modal', function () {
        console.log('loaded!!!')
        const tbl = document.getElementById("log-tbl");
        $(tbl).bootstrapTable('removeAll');
    });

    function generate_overview_stats() {
        let categories = [
            {title: "Total Analyzed", id: "stat-total", class: "primary", icon: "fa-vials"},
            {title: "Drug Susceptible", id: "stat-ds", class: "ds", icon: "fa-pills"},
            {title: "Mono resistance", id: "stat-mono", class: "mono", icon: "fa-prescription-bottle"},
            {title: "Poly-drug resistance", id: "stat-poly", class: "poly", icon: "fa-prescription-bottle-alt"},
            {title: "MDR isolates", id: "stat-mdr", class: "mdr", icon: "fa-skull-crossbones"},
            {title: "Pre-XDR isolates", id: "stat-prexdr", class: "prexdr", icon: "fa-exclamation-triangle"},
            {title: "XDR isolates", id: "stat-xdr", class: "xdr", icon: "fa-biohazard"},
            {title: "other", id: "stat-other", class: "other", icon: "fa-question-circle"},
        ];

        const container = document.getElementById('header-container')
        categories.forEach(function (category) {
            let card = `<div class="card border-2 border-left-${category.class} shadow-sm h-100 py-1 mx-1">
               <div class="card-body">
                  <div class="row align-items-center">
                        <div class="font-weight-bold text-uppercase text-${category.class} mb-1">
                    ${category.title}</div>
                        <div class="h5 mb-0 text-center font-weight-bold" id="${category.id}">0</div>
                  </div>
               </div>
            </div>`
            $(container).append(card);
        });

    }

    function plot_temporal_dist(data) {

        if (!data) return

        d3.select("#temporal-plot").selectAll('*').remove()
        let c = d3.select('#temporal-card');
        let cw = parseFloat(c.style('width')), ch = Math.max(200, parseFloat(c.style('height')));

        const margin = {top: 10, right: 40, bottom: 20, left: 30},
            width = cw - margin.left - margin.right,
            height = ch - margin.top - margin.bottom;

        const svg = d3.select("#temporal-plot")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        data.forEach((d) => {
            d.value = Math.floor(Math.random() * 10) + 1;
            d.date = new Date(d.date);
        });

        const xExtent = d3.extent(data, d => d.date);
        xExtent[0] = new Date(xExtent[0].getTime() - 10 * 24 * 60 * 60 * 1000);
        xExtent[1] = new Date(xExtent[1].getTime() + 10 * 24 * 60 * 60 * 1000);

        const x = d3.scaleTime().domain(xExtent).range([0, width]).nice();
        const xAxis = svg.append("g").attr('class', 'axis x-axis').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));

        const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value)]).range([height, 0]).nice();
        const yAxis = d3.axisLeft(y).tickValues([]);
        //svg.append('g').attr('class', 'axis y-axis').call(yAxis);

        const brush = d3.brushX().extent([[0, -margin.top], [width, height + margin.top]]).on("end", brushended);
        const scatter = svg.append('g').attr("clip-path", "url(#clip)");
        scatter.append("g").attr("class", "brush").call(brush);

        scatter.selectAll('.point')
            .data(data)
            .enter()
            .append("circle")
            .attr('class', d => `point bg-${d.cat.toLowerCase()}`)
            .attr("cx", d => x(d.date))
            .attr("cy", d => y(d.value))
            .attr("r", 5);
        scatter.selectAll('.point')
            .on('mouseover', function (event, d) {
                var tooltip = d3.select("#tooltip");
                tooltip.transition().duration(200).style('opacity', .9);
                tooltip.html(`<p class="p-0 m-1 text-white"><small>Sample</small>: ${d.sample}
                              <br><small>Category</small>: ${d.cat.toUpperCase()}</p>`)
                    .style('left', (event.pageX + 5) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function (d) {
                var tooltip = d3.select("#tooltip");
                tooltip.transition().duration(500).style('opacity', 0);
            });


        let idleTimeout;

        function idled() {
            idleTimeout = null;
        }

        function brushended(event) {
            const selection = event.selection;
            if (!selection) {
                if (!idleTimeout) return idleTimeout = setTimeout(idled, 350);
                x.domain([xExtent[0], xExtent[1]]);
            } else {
                const [x0, x1] = selection.map(x.invert);
                x.domain([x0, x1]);
                scatter.select(".brush").call(brush.move, null);
            }
            xAxis.transition().duration(1000).call(d3.axisBottom(x));
            svg.selectAll("circle").transition().duration(1000).attr('cx', d => x(d.date));
        }
    }

    function fill_stats(data) {
        console.log(data)
        $.each(data, function (k, v) {
            console.log(k)
            const el = document.getElementById(`stat-${k}`)
            $(el).text(v)
        })
    }

    function request_overview_data() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/fetch-overview/', true);

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Parse the response JSON
                data = JSON.parse(xhr.responseText);
                Overview_data = data;
                plot_temporal_dist(data.samples)
                fill_stats(data.stats)
            } else {
                console.error('Error fetching samples:', xhr.statusText);
            }
        };
        xhr.onerror = function () {
            console.error('Network error');
        };

        xhr.send();
    }

// Function calls
    init();
    import_connect_events();
    upload_connect_events();
    job_send_request()

})
;