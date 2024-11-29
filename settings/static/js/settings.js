$(document).ready(function () {

    function init() {
        connect_upload_json();
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


    //-------
    init()
});