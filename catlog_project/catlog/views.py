from django.shortcuts import render, redirect, reverse
from django.http import HttpResponse, JsonResponse
from django.db.models import F
from catlog.models import *
from django.db import transaction
from hashids import *
from django.views.decorators.http import require_http_methods, require_GET, require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
import json

# Setup the hashids object.
hashids = Hashids(salt="catlog rocks")

# Create your views here.
def index(request):
    return new_catlog_page(request)

@require_GET
def all_rows(request, catlog_key):
    # Get the CatlogTable from the catlog_key.
    rowTable = None
    try:
        rowTable = CatlogTable.objects.get(name = catlog_key)
        rowsList = list(CatlogRow.objects.filter(table = rowTable).values())
    except CatlogTable.DoesNotExist:
        rowsList = []

    return JsonResponse({'rows' : rowsList})

@require_POST
@transaction.atomic
def update_rows(request, catlog_key):
    jsonString = request.body

    # Get the CatlogTable from the catlog_key.
    rowTable, rowTableCreated = CatlogTable.objects.get_or_create(name = catlog_key)

    table_event_array = json.loads(jsonString)

    print(table_event_array)

    # For each table event array run the event.
    for table_event in table_event_array:
        table_event_type = table_event[u'eventType']
        row_id = int(table_event[u'rowId'])
        row_data = table_event[u'rowData']

        print(table_event_type, " event ... ")

        if table_event_type == u'table_event_type_new':
            new_row_get_or_create = CatlogRow.objects.get_or_create(
                rowId = row_id,
                table = rowTable
            )

            new_row = new_row_get_or_create[0]

            new_row.name = row_data[u'name']
            new_row.count = row_data[u'count']
            new_row.description = row_data[u'description']
            new_row.save()

        elif table_event_type == u'table_event_type_edit':
            new_row_get_or_create = CatlogRow.objects.get_or_create(
                rowId = row_id,
                table = rowTable
            )

            print("editing ", row_id, new_row_get_or_create)

            new_row = new_row_get_or_create[0]

            print(new_row_get_or_create[1])

            new_row.name = row_data[u'name']
            new_row.count = row_data[u'count']
            new_row.description = row_data[u'description']
            new_row.save()

        elif table_event_type == u'table_event_type_delete':
            try:
                row_to_delete = CatlogRow.objects.get(
                    rowId = row_id,
                    table = rowTable
                )

                row_to_delete.delete()
            except CatlogRow.DoesNotExist:
                print("Row does not exist")
                return HttpResponse("row does not exist", status=444)
        else:
            print("test")
            return HttpResponse("internal server error", 501)

    print("hey")
    return HttpResponse(str(len(table_event_array)) + " table events processed", status=201)


"""
@require_POST
def edit_row(request, catlog_key, row_id):
    name = request.POST.get('name')
    count = request.POST.get('count')
    description = request.POST.get('description')

    # TODO: Maybe we should use a form here?
    new_row_get_or_create = CatlogRow.objects.get_or_create(
        rowId = row_id,
        table = catlog_key
    )

    new_row = new_row_get_or_create[0]

    new_row.name = name
    new_row.count = count
    new_row.description = description
    new_row.save()

    return HttpResponse("row edited or created", status=201)

@require_POST
def delete_row(request, catlog_key, row_id):
    try:
        row_to_delete = CatlogRow.objects.get(
            rowId = row_id,
            table = catlog_key
        )

        row_to_delete.delete()
        return HttpResponse("row deleted successfully", status=200)
    except CatlogRow.DoesNotExist:
        return HttpResponse("row does not exist", status=404)
"""


@ensure_csrf_cookie
def view_catlog_page(request, catlog_key):
    context = {
        "mainDatabaseId" : catlog_key,
        "mainDatabaseUrl" : request.build_absolute_uri(),
        "indexPageUrl" : reverse('index')
    }

    # context.update(csrf(request))

    return render(request, 'catlog/catlog.html', context)

# TODO: What if someone uses /v0/ as a custom URL then
# someone else visits /v-1/ and then clicks "new"?
# Should we maintain a table of "urls that are in use"?.

def new_catlog_page(request):
    # Create a new catlog_key.
    current_id_object = None
    try:
        current_id_object = CatlogTableCurrentId.objects.all()[0]
    except (CatlogTableCurrentId.DoesNotExist, IndexError) as ex:
        print(ex)
        # This is an entirely new website, where the only row
        # required in CatlogTableCurrentId does not exist yet.
        current_id_object = CatlogTableCurrentId.objects.create(
            current_id = 0,
            site = Site.objects.get_current()
            )

    # Until the key is "unused" keep generating new keys.
    key_is_unused = False
    while not key_is_unused:
        # Increment the counter (atomically) and save the row.
        # TODO: Is this concurrent safe?
        new_id = -1
        try:
            with transaction.atomic():
                new_id = current_id_object.current_id
                current_id_object.current_id = new_id + 1
                current_id_object.save()
        except IntegrityError:
            return HttpResponse(status = 500)

        if new_id == -1:
            return HttpResponse(status = 500)

        new_id_key = hashids.encode(new_id)

        # Has this key been used before?
        try:
            CatlogTable.objects.get(name = new_id_key)
        except CatlogTable.DoesNotExist:
            key_is_unused = True

    # Redirect the user to the view_catlog_page for this key.
    context = {}
    return redirect('view_catlog_page', catlog_key = new_id_key)