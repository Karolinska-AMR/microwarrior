from django.urls import path
from . import views


urlpatterns = [
    path('login_user', views.login_user, name="login"),
    path('logout_user', views.logout_user, name='logout'),
    path('change_password', views.PasswordsChangeView.as_view(template_name="change-password.html"),
         name="change-password"),
    path('password_success',views.password_success,name='password-success'),
]
