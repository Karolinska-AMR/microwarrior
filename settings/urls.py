from django.urls import path
from django.urls import re_path
from . import views
from users import views as usr_view
urlpatterns = [
    path('settings', views.get_page, name="settings_page"),
    path("upload-json/", views.upload_json, name="upload_json"),
    re_path(r'^get-del-samples/?$', views.fetch_del_samples, name="get_del_samples"),
    re_path(r'^del-samples/', views.delete_samples, name="del_samples"),
    re_path(r'^get-users/', views.fetch_users, name="get_usrs"),
    path('add-user/', usr_view.add_user, name='add_user'),
    path('edit-user/<int:user_id>/', usr_view.edit_user, name='edit_user'),
    path('reset-password/<int:user_id>/', usr_view.reset_password, name='reset_password'),

]
