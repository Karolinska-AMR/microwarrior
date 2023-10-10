from django.urls import path
from . import views

urlpatterns = [
    path('upload/<slug:id>', views.upload, name="upload"),
]
