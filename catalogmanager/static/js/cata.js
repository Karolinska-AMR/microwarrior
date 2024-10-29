$(document).ready(function () {

    var SEARCH_DATA;
    var SELECTED_MU_ID, SELECTED_ROW_INDEX = -2;

    function init() {
        fetch_drgr();

        reset_mu_details();

        let tables = ['result-tbl', 'muinfo-tbl'];
        let table_type = (name) => name.startsWith('result') ? 'table-modal' : 'table-main';

        tables.forEach((tn) => {
            const tbl = document.getElementById(tn);
            $(tbl).bootstrapTable('destroy');
            $(tbl).bootstrapTable({
                formatNoMatches: function () {
                    return `<i class="fas fa-info"></i> ${gettext("Inga data att visa.")}`;
                },
                classes: "table table-sm text-sm " + table_type(tn),
                onResetView: function (e) {
                    if (tn.startsWith('result')) {
                        connect_row_event();
                    }
                }
            });

        });


        $("#search-btn").click(function () {
            let formData = {
                gn: $("#gene-input").val(),
                gr: $("#grade-select").val(),
                dr: $("#drug-select").val(),
                vr: $("#variant-input").val(),

            };

            let allFieldsEmpty = Object.values(formData).every(function (value) {
                return value === null || value.trim() === '';
            });

            if (allFieldsEmpty) {
                show_message(gettext('Vänligen fyll i minst ett fält.'), "message-container");

            } else {
                const result_tbl = document.getElementById('result-tbl');
                $(result_tbl).bootstrapTable('showLoading');
                fetch_evidences(formData);
            }
        });

        $("#pred-dg-select").change(function () {

            var selprd = $(this).val();
            var catprd = $("#pred-lbl").find('span').text();
            if (selprd === catprd) {
                $("#pred-dg-msg").hide();
            } else {
                $("#pred-dg-msg").show();
            }
        });
        $("#add-note-btn").click(function (event) {
            add_onclick(event);
        });
        $("#edit-dg-btn").click(function (event) {
            let noteid = $(this).closest(".modal").data('noteid');
            $(this).prop("disabled", true);
            post_edit_note(noteid);
        });

        $("#save-dg-btn").click(function () {
            $(this).prop("disabled", true);
            post_add_note();
        });

        $('#add-note-modal').on('hidden.bs.modal', function () {
            reset_add_modal();
        });

        $("#conf-del-btn").click(function () {
            let noteid = $(this).closest(".modal").data('noteid');
            post_del_note(noteid);
        });

        $("#cls-form").click(function () {
            document.getElementById('filter-form').reset();
            $("#result-tbl").bootstrapTable("removeAll");
            reset_mu_details();
            SEARCH_DATA = null;
        });
        $("#cls-dg-form").click(function () {
            reset_add_modal();
        });


    }

    function create_note_alert(d) {
        // Create the outermost div (alert-light)
        let alertDiv = document.createElement('div');
        alertDiv.className = "alert alert-light";

        // Create the alert heading div
        let alertHeadingDiv = document.createElement('div');
        alertHeadingDiv.className = "alert-heading";

        // Create the first inner div with buttons and user info
        let innerDiv1 = document.createElement('div');
        innerDiv1.classList.add('d-flex', 'justify-content-between');

        // Create the button group
        let btnGroupDiv = document.createElement('div');
        btnGroupDiv.className = 'btn-group btn-group-sm';
        btnGroupDiv.setAttribute('role', 'group');

        let editBtn = document.createElement('button');

        editBtn.type = 'button';
        editBtn.className = 'btn btn-light';
        editBtn.id = 'edit-note';
        editBtn.setAttribute('data-noteid', d.id);
        editBtn.setAttribute('title', gettext('rediger anteckningen'));
        editBtn.innerHTML = '<i class="fas fa-edit"></i>'
        $(editBtn).on('click', edit_onclick);

        let deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.classList.add('btn', 'btn-light', 'del-btn');
        deleteBtn.setAttribute('data-noteid', d.id);
        deleteBtn.setAttribute('title', 'radera anteckningen');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'
        $(deleteBtn).on('click', del_onclick);

        // Append buttons to the button group
        btnGroupDiv.appendChild(editBtn);
        btnGroupDiv.appendChild(deleteBtn);

        // Create the user info section
        let userInfoDiv = document.createElement('div');
        userInfoDiv.classList.add('d-flex', 'justify-content-end', 'align-items-center', 'flex-wrap', 'fs-small');

        let editDateDiv = document.createElement('div');
        editDateDiv.classList.add('me-3');
        let editDateLabel = document.createElement('span');
        editDateLabel.innerText = `${gettext('Redigerades på')}: `;
        let editDateValue = document.createElement('span');
        editDateValue.classList.add('fst-italic');
        editDateValue.id = 'date-lbl';
        editDateValue.innerText = d.last_edit;

        editDateDiv.appendChild(editDateLabel);
        editDateDiv.appendChild(editDateValue);

        let editedByDiv = document.createElement('div');
        editedByDiv.classList.add('me-3');
        let editedByLabel = document.createElement('span');
        editedByLabel.innerText = `${gettext('Av')}: `;
        let editedByValue = document.createElement('span');
        editedByValue.classList.add('text-uppercase', 'fst-italic');
        editedByValue.id = 'usr-lbl';
        editedByValue.innerText = d.author;

        editedByDiv.appendChild(editedByLabel);
        editedByDiv.appendChild(editedByValue);

        // Append user info to the user info div
        userInfoDiv.appendChild(editDateDiv);
        userInfoDiv.appendChild(editedByDiv);

        // Append button group and user info to the first inner div
        innerDiv1.appendChild(btnGroupDiv);
        innerDiv1.appendChild(userInfoDiv);

        // Append first inner div to the alert heading
        alertHeadingDiv.appendChild(innerDiv1);

        // Create the <hr> separator
        let hr = document.createElement('hr');
        hr.className = "my-1"
        // Create the row for note and predicted outcome
        let rowDiv = document.createElement('div');
        rowDiv.classList.add('row');

        // Create the note column
        let noteCol = document.createElement('div');
        noteCol.classList.add('col-9');
        let noteText = document.createElement('p');
        noteText.classList.add('text-dark');
        noteText.id = 'note-text';
        noteText.innerText = gettext(d.note);
        noteCol.appendChild(noteText);

        // Create the prediction column
        let predCol = document.createElement('div');
        predCol.classList.add('col-3');

        let predTitle = document.createElement('h6');
        predTitle.classList.add('text-center', 'text-capitalize');
        let strongTitle = document.createElement('strong');
        strongTitle.innerText = `${gettext('föreslagit resultat')}:`;
        predTitle.appendChild(strongTitle);


        let predCircle = document.createElement('div');
        predCircle.className = 'pred-circle text-capitalize d-flex ' + get_pred_bg(d.prediction) +
            ' justify-content-center align-items-center mx-auto';
        predCircle.id = 'note-pred';
        predCircle.innerText = d.prediction;

        predCol.appendChild(predTitle);
        predCol.appendChild(predCircle);

        // Append columns to the row
        rowDiv.appendChild(noteCol);
        rowDiv.appendChild(predCol);

        // Append everything to the main alert div
        alertDiv.appendChild(alertHeadingDiv);
        alertDiv.appendChild(hr);
        alertDiv.appendChild(rowDiv);

        return alertDiv
    }

    function get_pred_bg(p) {
        p = p.toLowerCase();
        return $.inArray(p, ['r', 'u', 's']) !== -1 ? 'text-bg-' + p : 'text-bg-o';
    }

    function add_onclick(event) {

        $("#save-btn-group").show();
        $("#edit-btn-group").hide();
        $("#ad-modal-title").html(`<i class="fas fa-plus"></i> ${gettext("ny notering")}</h5>`);
        let pred = $("#pred-lbl .pred-circle").text();
        $("#pred-dg-select").val(pred).change();
        $("#add-note-modal").data('noteid', '').modal('show');
    }

    function edit_onclick(event) {
        const id = $(this).data('noteid');

        $("#save-btn-group").hide();
        $("#edit-btn-group").show();
        $("#edit-dg-btn").prop("disabled", false);
        $("#ad-modal-title").html(`<i class="fas fa-edit"></i> ${gettext("Ändra notering")}</h5>`);


        const idx = SEARCH_DATA[SELECTED_MU_ID].notes.findIndex(item => item.id === id);
        const note = SEARCH_DATA[SELECTED_MU_ID].notes[idx];

        $("#pred-dg-select").val(note.prediction).change();
        $("#note-dg-input").val(note.note);


        $("#add-note-modal").data('noteid', id).modal('show');
    }

    function del_onclick(event) {
        const id = $(this).data('noteid');
        $('#del-conf-modal').data('noteid', id).modal('show');
    }

    function fetch_evidences(params, direct_import = false) {
        let queryString = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');

        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/get-evidence/?' + queryString, true);

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Parse the response JSON
                SEARCH_DATA = JSON.parse(xhr.responseText);
                console.log(SEARCH_DATA);
                fill_mutation(SEARCH_DATA);
                const result_tbl = document.getElementById('result-tbl');
                $(result_tbl).bootstrapTable('hideLoading');
                document.getElementById('filter-form').reset();
            } else {
                const result_tbl = document.getElementById('result-tbl');
                $(result_tbl).bootstrapTable('hideLoading');

            }
        };

        xhr.onerror = function () {
            show_message(gettext('Nätverksfel'), "message-container");
        };

        xhr.send();
    }

    function fetch_drgr() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/get-drgr/', true);

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Parse the response JSON
                let data = JSON.parse(xhr.responseText);
                add_drug_names(data.drug_names);
                add_grads(data.grades);
            } else {
                show_message(gettext('Fel vid hämtning av metadata'), "message-container");
            }
        };
        xhr.onerror = function () {
            show_message(gettext('Nätverksfel'), "message-container");
        };

        xhr.send();
    }

    function add_drug_names(drugs) {
        let dsel_tag = $("#drug-select");
        $.each(drugs, function (index, drug) {
            dsel_tag.append('<option value="' + drug + '">' + drug + '</option>');
        });
    }

    function add_grads(grades) {
        let gsel_tag = $("#grade-select");
        $.each(grades, function (index, grade) {

            let grade_txt = grade.startsWith('1') ? "1. " + gettext("Associerad med resistens") :
                grade.startsWith('2') ? "2. " + gettext("Associerad med resistens-interim") :
                    grade.startsWith('3') ? "3. " + gettext("Osäker signifikans") :
                        grade.startsWith('4') ? "4. " + gettext("Känslig-interim") :
                            grade.startsWith('5') ? "5. " + gettext("Känslig") : grade;

            gsel_tag.append('<option value="' + grade + '">' + gettext(grade_txt) + '</option>');
        });
    }

    function fill_mutation(data) {
        const result_tbl = $('#result-tbl');
        result_tbl.bootstrapTable("removeAll");
        $.each(data, function (k, m) {
            let note_icon = m.notes.length > 0 ? '<i class="fas fa-receipt"></i>' : '';
            m.action = `<span class="action-col" data-id='${k}'><i class="fas text-white fa-lg fa-circle"></i> ${note_icon}<span>`
            m.grade_badge = add_grade_badge(m.grade, "text-dark");
            result_tbl.bootstrapTable("insertRow", {index: 0, row: m});
        });

        if (Object.keys(data).length === 1) {
            setTimeout(function () {
                const tr_elm = $(`#result-tbl tr[data-index="0"]`);
                tr_elm.trigger("click");
            }, 500);

        }

    }

    function connect_row_event() {
        if (SELECTED_ROW_INDEX > -1) {
            const tr_elm = $(`#result-tbl tr[data-index="${SELECTED_ROW_INDEX}"]`);
            tr_elm.addClass("selected-row");
            const icon = tr_elm.find(".action-col i:first-child");
            if (icon.length) {
                icon.removeClass("fa-circle").addClass("fa-arrow-alt-circle-right");
            }
        }

        $("#result-tbl tbody tr").click(function () {

            let selected_id = $(this).find('.action-col').attr('data-id');
            let index = $(this).closest('tr').data('index');

            if (!selected_id) return;
            if (selected_id !== SELECTED_MU_ID) {
                const icons = document.querySelectorAll("#result-tbl .action-col svg:first-child");
                let tid;
                for (const icon of icons) {
                    tid = $(icon).closest("span").attr("data-id");
                    if (tid === selected_id) {
                        $(icon).removeClass("fa-circle").addClass("fa-arrow-alt-circle-right");
                        $(icon).closest("tr").addClass("selected-row");
                    } else {
                        $(icon).removeClass("fa-arrow-alt-circle-right").addClass("fa-circle");
                        $(icon).closest("tr").removeClass("selected-row");
                    }
                }
                reset_mu_details();
                $("#detail-card").show();
                $('html, body').animate({
                    scrollTop: $('#detail-card').offset().top
                }, 500);
                setTimeout(function () {
                    fill_details(selected_id);
                }, 400);
                SELECTED_MU_ID = selected_id;
                SELECTED_ROW_INDEX = index;
            }
        });
    }

    function fill_details(id) {

        const data = SEARCH_DATA[id];
        if (!data) {
            return; // Handle potential missing data
        }

        const mutationLabel = `${data.gene}@${data.variant}`;
        const drugLabel = data.drug;
        const gradeLabel = add_grade_badge(data.grade, "fs-6 fst-italic text-dark");
        const predIcon = add_pred_icon(data.grade, "");

        $("#mutation-lbl").text(mutationLabel);
        $("#mutation-lbl").attr('data-muid', data.id);
        $("#mutation-dg-lbl").text(mutationLabel);

        $("#drug-lbl").text(drugLabel);
        $("#drug-dg-lbl").text(drugLabel);

        $("#grade-lbl").html(gradeLabel);
        $("#grade-dg-lbl").text($(gradeLabel).text());

        $("#pred-lbl").html(predIcon);
        $("#pred-dg-select").val($(predIcon).text()).change();

        const muinfoTbl = $('#muinfo-tbl');
        data.OR = data.OR === -999 ? '&#8734;' : data.OR;
        muinfoTbl.bootstrapTable("insertRow", {index: 0, row: data});

        const noteGroup = $("#note-group");
        noteGroup.empty();
        update_note_groups(data.notes, noteGroup);

    }

    function update_note_groups(notes, noteGroup) {
        if (notes.length > 0) {
            $("#empty_msg").hide();
            notes.forEach(note => noteGroup.append(create_note_alert(note)));
        } else {
            $("#empty_msg").show();
        }
    }

    function add_grade_badge(grade, classes = "") {
        // Grade is available
        const gradeClasses = {
            '1': "text-bg-r",
            '2': "text-bg-ri",
            '3': "text-bg-u",
            '4': "text-bg-si",
            '5': "text-bg-s"
        };

        const gradeKey = Object.keys(gradeClasses).find(key => grade.startsWith(key)) || 'default';

        let grade_txt = grade.startsWith('1') ? "1. " + gettext("Associerad med resistens") :
            grade.startsWith('2') ? "2. " + gettext("Associerad med resistens-interim") :
                grade.startsWith('3') ? "3. " + gettext("Osäker signifikans") :
                    grade.startsWith('4') ? "4. " + gettext("Känslig-interim") :
                        grade.startsWith('5') ? "5. " + gettext("Känslig") : null;

        return `<span class="badge fw-bold ${classes} ${gradeClasses[gradeKey] || ''}">${gettext(grade_txt)}</span>`;

    }

    function add_pred_icon(grade, classes = "") {
        // Grade is available
        const gradeClasses = {
            '1': {"c": "text-bg-r", "t": "R"},
            '2': {"c": "text-bg-r", "t": "R"},
            '3': {"c": "text-bg-u", "t": "U"},
            '4': {"c": "text-bg-s", "t": "S"},
            '5': {"c": "text-bg-s", "t": "S"},
        };

        const gradeKey = Object.keys(gradeClasses).find(key => grade.startsWith(key)) || 'default';
        let default_class = "pred-circle text-capitalize"
        return `<span class="${default_class} ${classes} ${gradeClasses[gradeKey]["c"] || ''} ">${gettext(gradeClasses[gradeKey]["t"] || '?')}</span>`;

    }

    function reset_mu_details() {
        SELECTED_MU_ID = -1;
        SELECTED_ROW_INDEX = -2;
        $("#detail-card").hide();
        $(".dynamic-content").text('-');
        $("#mutation-lbl").attr('data-muid', '-1');
        $("#muinfo-tbl").bootstrapTable('removeAll');
        $("#empty_msg").show()
    }

    function reset_add_modal() {
        let pred = $("#pred-lbl .pred-circle").text();
        $("#pred-dg-select").val(pred).change();
        $("#note-dg-input").val("");
        $("#save-dg-btn").prop("disabled", false);
    }

    function post_add_note() {

        let note = $("#note-dg-input").val();
        if (note === null || note.trim() === '') {
            show_message(gettext('Vänligen ange text till noten.'), "ad-message-dg-container");
            $("#save-dg-btn").prop("disabled", false);
        } else {
            var formData = new FormData();
            formData.append("prediction", $("#pred-dg-select").val());
            formData.append("note", note);
            formData.append("mutation_id", SELECTED_MU_ID);

            $.ajaxSetup({
                headers: {
                    "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                }
            });
            $.ajax({
                url: '/add-note/',
                type: 'POST',
                dataType: 'json',
                cache: false,
                processData: false,
                contentType: false,
                data: formData,
                success: function (response) {
                    if (response.success) {
                        add_note_onpage(response.note);
                        show_message(gettext('Noten har sparats.'), "ad-message-dg-container", type = "success");
                        setTimeout(function () {
                            $('#add-note-modal').modal('hide');
                        }, 1000);

                    } else {
                        show_message(gettext('Ett oväntat fel inträffade.') + response.message, "ad-message-dg-container");

                        $("#save-dg-btn").prop("disabled", false);
                    }
                },
                error: function () {
                    show_message(gettext('Ett oväntat fel inträffade.'), "ad-message-dg-container");
                    $("#save-dg-btn").prop("disabled", false);
                }
            });
        }
    }

    function add_note_onpage(data) {
        const mutationData = SEARCH_DATA[data.mutation_id];
        const isFirstNote = mutationData.notes.length === 0;

        // Add new note at the beginning of notes array
        mutationData.notes.unshift(data);

        // Refresh the note group display
        const noteGroup = $("#note-group").empty();
        update_note_groups(mutationData.notes, noteGroup);

        // Update table cell if it's the first note
        if (isFirstNote) {
            $("#result-tbl").bootstrapTable('updateCell', {
                index: SELECTED_ROW_INDEX,
                field: 'action',
                value: `
            <span class="action-col" data-id='${data.mutation_id}'>
                <i class="fas text-white fa-lg fa-circle"></i>
                <i class="fas fa-receipt"></i>
            </span>`
            });
        }
    }

    function post_del_note(note_id) {

        var formData = new FormData();
        formData.append("note_id", note_id);

        $.ajaxSetup({
            headers: {
                "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
            }
        });
        $.ajax({
            url: '/del-note/',
            type: 'POST',
            dataType: 'json',
            cache: false,
            processData: false,
            contentType: false,
            data: formData,
            success: function (response) {
                if (response.success) {
                    del_note_onpage(response.note);
                    show_message(gettext('Noten raderas.'), "del-message-dg-container", type = "success");
                    setTimeout(function () {
                        $('#del-conf-modal').modal('hide');
                    }, 1000);

                } else {
                    show_message(response.message,
                        "del-message-dg-container", type = 'error', timer = 5000);

                    $("#save-dg-btn").prop("disabled", false);
                }
            },
            error: function () {
                show_message(gettext('Ett oväntat fel inträffade.'), "del-message-dg-container", type = 'error', timer = 5000);
                $("#save-dg-btn").prop("disabled", false);
            }
        });

    }

    function del_note_onpage(data) {
        const mutationData = SEARCH_DATA[data.mutation_id];

        let indexToRemove = mutationData.notes.findIndex(item => item.id === data.note_id);
        // Remove the object at the found index
        if (indexToRemove !== -1) {
            mutationData.notes.splice(indexToRemove, 1);
        }

        // Refresh the note group display
        const noteGroup = $("#note-group").empty();
        if (mutationData.notes.length > 0) {
            update_note_groups(mutationData.notes, noteGroup);
        } else {
            // Update table cell if it was the last note
            $("#result-tbl").bootstrapTable('updateCell', {
                index: SELECTED_ROW_INDEX,
                field: 'action',
                value: `<span class="action-col" data-id='${data.mutation_id}'><i class="fas text-white fa-lg fa-circle"></i></span>`
            });
        }


    }

    function post_edit_note(note_id) {

        let note = $("#note-dg-input").val();
        if (note === null || note.trim() === '') {
            show_message(gettext('Vänligen ange text till noten.'), "ad-message-dg-container");
            $("#edit-dg-btn").prop("disabled", false);
        } else {
            var formData = new FormData();
            formData.append("prediction", $("#pred-dg-select").val());
            formData.append("note", note);
            formData.append("note_id", note_id);
            formData.append("mutation_id", SELECTED_MU_ID);

            $.ajaxSetup({
                headers: {
                    "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
                }
            });
            $.ajax({
                url: '/edit-note/',
                type: 'POST',
                dataType: 'json',
                cache: false,
                processData: false,
                contentType: false,
                data: formData,
                success: function (response) {
                    if (response.success) {
                        edit_note_onpage(response.note);
                        show_message(gettext('Noten har sparats.'), "ad-message-dg-container", type = "success");
                        setTimeout(function () {
                            $('#add-note-modal').modal('hide');
                        }, 1000);

                    } else {
                        show_message(gettext('Ett oväntat fel inträffade.') + response.message, "ad-message-dg-container");
                        $("#edit-dg-btn").prop("disabled", false);
                    }
                },
                error: function () {
                    show_message(gettext('Ett oväntat fel inträffade.'), "ad-message-dg-container");
                    $("#edit-dg-btn").prop("disabled", false);
                }
            });
        }
    }

    function edit_note_onpage(note) {
        const mutationData = SEARCH_DATA[note.mutation_id];
        let idx = mutationData.notes.findIndex(item => item.id === note.oid);
        if (idx !== -1) {
            mutationData.notes.splice(idx, 1);
        }
        mutationData.notes.unshift(note);


        // Refresh the note group display
        const noteGroup = $("#note-group").empty();
        update_note_groups(mutationData.notes, noteGroup);
    }

    function show_message(message, tag, type = 'error', timer = 3000) {

        let mpr = {
            "error": {txt: "text-danger", ico: 'fa-exclamation-circle'},
            "warning": {txt: "text-warning", ico: "fa-exclamation-triangle"},
            "success": {txt: "text-success", ico: "fa-check-circle"}
        }


        $("#" + tag).html(`<div id="message-alert" class="${mpr[type].txt} fade show" role="alert">
                             <i class="fas ${mpr[type].ico}"></i> ${message}
                                 </div>`).show();

        setTimeout(function () {
            const el = document.getElementById('message-alert');
            var bsAlert = new bootstrap.Alert(el);
            bsAlert.close();
        }, timer);
    }

    init();
})
;