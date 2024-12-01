from django.urls import path
from django.urls import re_path
from . import views

urlpatterns = [
    path('settings', views.get_page, name="settings_page"),
    path("upload-json/", views.upload_json, name="upload_json"),
    re_path(r'^get-del-samples/?$', views.fetch_del_samples, name="get_del_samples"),
    re_path(r'^del-samples/', views.delete_samples, name="del_samples"),
]
