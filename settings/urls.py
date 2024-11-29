from django.urls import path

from . import views

urlpatterns = [
    path('settings', views.get_page, name="settings_page"),
    path("upload-json/", views.upload_json, name="upload_json"),

]
