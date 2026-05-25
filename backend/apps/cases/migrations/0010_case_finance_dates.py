from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cases", "0009_case_document_folders"),
    ]

    operations = [
        migrations.AddField(
            model_name="case",
            name="first_payment_at",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="case",
            name="next_payment_due_at",
            field=models.DateField(blank=True, null=True),
        ),
    ]
