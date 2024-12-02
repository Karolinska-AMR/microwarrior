from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.models import User
from django import forms
from django.utils.translation import gettext as _

import re

class PasswordChangingForm(PasswordChangeForm):
    old_password = forms.CharField(label=_("Gammalt lösenord"),max_length=50,widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))
    new_password1 = forms.CharField(label=_("Nytt lösenord"),max_length=50, widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))
    new_password2 = forms.CharField(label=_("Bekräfta lösenord"),max_length=50, widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))

    class Meta:
        model = User
        fields = ('old_password', 'new_password1', 'new_password2')



class AddUserForm(forms.ModelForm):
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "form-control"}),
        label="Password"
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "form-control"}),
        label="Confirm Password"
    )

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name"]

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")
        if password != confirm_password:
            raise forms.ValidationError("Passwords do not match.")

        self.validate_password(password)

        return cleaned_data

    def validate_password(self,password):
        message = [ "Error in password:",
                   'Password must be at least 8 characters long.',
                   "Password must contain at least one lowercase letter. (a-z)",
                   "Password must contain at least one uppercase letter. (A-Z)",
                   "Password must contain at least one number. (0-9)",
                   "Password must contain at least one special character. (!@#$%^&*())",]
        if len(password)<8:
            message[1] = ">> "+message[1]
            raise forms.ValidationError('\n'.join(message))
        if not any(char.islower() for char in password):
            message[2] = ">> " + message[2]
            raise forms.ValidationError('\n'.join(message))
        if not any(char.isupper() for char in password):
            message[3] = ">> " + message[3]
            raise forms.ValidationError('\n'.join(message))
        if not any(char.isdigit() for char in password):
            message[4] = ">> " + message[4]
            raise forms.ValidationError('\n'.join(message))
        if not any(char in "!@#$%^&*()" for char in password):
            message[5] = ">> " + message[5]
            raise forms.ValidationError('\n'.join(message))


    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = f"{self.cleaned_data['last_name'].lower()}.{self.cleaned_data['first_name'].lower()}".replace(' ','.')
        user.set_password(self.cleaned_data["password"])
        if commit:
            user.save()
        return user

class EditUserForm(forms.ModelForm):

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name"]

    def clean(self):
        cleaned_data = super().clean()
        first_name = cleaned_data.get("first_name")
        last_name = cleaned_data.get("last_name")
        if not re.match(r'^[a-zA-ZåäöÅÄÖ.\-\s]+$', first_name):
            raise forms.ValidationError("First name can only contain letters, hyphens, dot, space and nordic characters.")
        if not re.match(r'^[a-zA-ZåäöÅÄÖ.\-\s]+$', last_name):
            raise forms.ValidationError("Last name can only contain letters, hyphens, dot, space and nordic characters.")

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = f"{self.cleaned_data['last_name'].lower()}.{self.cleaned_data['first_name'].lower()}".replace(' ','.')
        if commit:
            user.save()
        return user

class ResetPasswordForm(forms.ModelForm):
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "form-control"}),
        label="Password", required=True
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "form-control"}),
        label="Confirm Password", required=True
    )

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name",'password']

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")
        if password != confirm_password:
            raise forms.ValidationError("Passwords do not match.")

        self.validate_password(password)

        return cleaned_data

    def validate_password(self,password):
        message = [ "Error in password:",
                   'Password must be at least 8 characters long.',
                   "Password must contain at least one lowercase letter. (a-z)",
                   "Password must contain at least one uppercase letter. (A-Z)",
                   "Password must contain at least one number. (0-9)",
                   "Password must contain at least one special character. (!@#$%^&*())",]
        if len(password)<8:
            message[1] = ">> "+message[1]
            raise forms.ValidationError('\n'.join(message))
        if not any(char.islower() for char in password):
            message[2] = ">> " + message[2]
            raise forms.ValidationError('\n'.join(message))
        if not any(char.isupper() for char in password):
            message[3] = ">> " + message[3]
            raise forms.ValidationError('\n'.join(message))
        if not any(char.isdigit() for char in password):
            message[4] = ">> " + message[4]
            raise forms.ValidationError('\n'.join(message))
        if not any(char in "!@#$%^&*()" for char in password):
            message[5] = ">> " + message[5]
            raise forms.ValidationError('\n'.join(message))


    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        if commit:
            user.save(update_fields=["password"])
        return user