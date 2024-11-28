from django.urls import path, re_path
from . import views

urlpatterns = [
    path('settings', views.get_page, name="settings_page"),

]