$(document).ready(function () {

    function init() {
        connect_upload_json();
        $("#rm-search-btn").click(send_search_sample);

        let tables = ['rm-samples'];

        tables.forEach((tn) => {
            const tbl = document.getElementById(tn);
            $(tbl).bootstrapTable('destroy');
            $(tbl).bootstrapTable({
                formatNoMatches: function () {
                    return `<i class="fas fa-info"></i> ${gettext("Inga data att visa.")}`;
                },
                classes: "table table-sm text-sm table-hover table-striped table-bordered table-main",
                onResetView: function (e) {
                    $(".undo-btn").click(undo_btn_rm);
                }
            });
        });

        $("#rm-remove-btn").click(function () {
            let row_count = $('#rm-samples').bootstrapTable('getOptions').totalRows;
            if (row_count > 0) {
                $('#confirmationModal').modal('show');
            } else {
                auto_hide_message("#rm-msg", gettext("Ingen data att radera."), 'danger');
            }
        });

        $("#confirm-delete").click(function () {
            send_del_sample();
            $('#confirmationModal').modal('hide');
        });
    }

    function connect_upload_json() {
        const uploadForm = document.getElementById("uploadForm");
        uploadForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = new FormData();
            const fileInput = document.getElementById("jsonFile");
            formData.append("json_file", fileInput.files[0]);

            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            try {
                const response = await fetch("/upload-json/", {
                    method: "POST",
                    body: formData,
                    headers: {
                        "X-CSRFToken": csrfToken, // Include the CSRF token
                    },
                });
                if (response.ok) {
                    const result = await response.json();
                    $('#log_textarea').val(result.message);
                    $('#log_textarea').scrollTop = $('#log_textarea').scrollHeight;
                } else {
                    $('#log_textarea').val("File upload failed!");
                    $('#log_textarea').scrollTop = $('#log_textarea').scrollHeight;
                }
            } catch (error) {

                $('#log_textarea').val("Error uploading file:", error);
                $('#log_textarea').scrollTop = $('#log_textarea').scrollHeight;
            }
        });
    }

    function send_search_sample() {
        const idInput = document.getElementById('samples-inpt');
        if (idInput.value.length > 5) {
            const ids = idInput.value.split('\n');
            let queryString = JSON.stringify(ids);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', `/get-del-samples/?ids=${encodeURIComponent(ids.join(','))}`, true);

            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    let samples_info = JSON.parse(xhr.responseText);
                    console.log(samples_info.data);
                    fill_rm_samples(samples_info.data);
                } else {
                    auto_hide_message("#rm-msg", gettext("Error sending IDs: ") + xhr.statusText, 'danger')
                }
            };

            xhr.onerror = function () {
                auto_hide_message("#rm-msg", gettext("Request failed."), 'danger')
            };

            xhr.send(queryString);

        } else {
            auto_hide_message("#rm-msg", gettext("Enter a valid sample-id."), 'danger');
        }
    }

    function send_del_sample() {

        const data = $('#rm-samples').bootstrapTable('getData');
        const sampleIds = data.map(item => item.sample);

        auto_hide_message("#rm-msg", "Sending the request...", 'info', timer = 5000);
        fetch('/del-samples/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
            },
            body: JSON.stringify({samples: sampleIds})
        })
            .then(response => response.json())
            .then(data => {
                auto_hide_message("#rm-msg", data.message, 'info', timer = 5000);
                $('#rm-samples').bootstrapTable("removeAll");
            })
            .catch(error => {
                auto_hide_message("#rm-msg", error.message, 'danger');
            });


    }

    function fill_rm_samples(data) {
        const rmTable = $('#rm-samples');
        rmTable.bootstrapTable("removeAll");

        const check = {
            true: {ico: `<i class="fas fa-lg fa-check-circle"></i>`, klass: 'text-success'},
            false: {ico: `<i class="fas fa-lg fa-times-circle"></i>`, klass: 'text-danger'}
        };

        data.forEach((m) => {
            ['pass_who', 'pass_cryptic', 'pass_tbprofiler'].forEach((key) => {
                m[`${key}_ico`] = `<span class="${check[m[key]].klass}">${check[m[key]].ico}</span>`;
            });

            Object.assign(m, {
                action: `<button class="btn btn-link undo-btn" data-sample="${m.sample}" title="${gettext("Ångra")}"><i class="fas fa-sign-out-alt fa-rotate-180"></i></button>`,
                ticket_trunc: `<span class="d-inline-block text-truncate" style="max-width: 6rem;">${m.ticket}</span>`
            });

            rmTable.bootstrapTable("insertRow", {index: 0, row: m});
        });


    }

    function undo_btn_rm() {
        const sample = $(this).data('sample');
        $('#rm-samples').bootstrapTable("removeByUniqueId", sample);
    }

    function auto_hide_message(tag, message, type, time = 3000) {
        $(tag).html("");
        const type_finder = {
            "info": {"icon": `<i class="fas fa-info-circle"></i>`, "klass": "text-info"},
            "warning": {"icon": `<i class="fas fa-info-circle"></i>`, "klass": "text-warning"},
            "danger": {"icon": `<i class="fas fa-exclamation-circle"></i>`, "klass": "text-danger"},
            "success": {"icon": `<i class="fas fa-exclamation-circle"></i>`, "klass": "text-success"}
        }
        let tf = type_finder[type]
        $(tag).html(`<span class="${tf.klass}">${tf.icon} ${message}</span>`)
        setTimeout(function () {
            $(tag).html("");
        }, time);

    }

    //-------
    init()
});